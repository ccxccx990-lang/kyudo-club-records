import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Vercel 本番: ブラウザを node_modules 配下に同梱する（ビルド時 install とセット） */
if (process.env.VERCEL === "1" && process.env.PLAYWRIGHT_BROWSERS_PATH == null) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
}

/** クライアントが送る HTML 断片の上限（悪用防止） */
const MAX_HTML_CHARS = 2_500_000;

function wrapPrintHtml(fragment: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet"/>
  <style>
    /* ブラウザや OS の「背景のグラフィック」設定に依存せず、面はすべて白にする */
    html, body {
      margin: 0;
      padding: 0;
      background: #fff !important;
      background-color: #fff !important;
    }
    body { display: block; }
    #hit-rate-pdf-vertical-wrap,
    #hit-rate-pdf-vertical-wrap * {
      background: #fff !important;
      background-color: #fff !important;
      box-shadow: none !important;
    }
    table { border-spacing: 0; border-collapse: collapse; }
    thead, tbody, tr, th, td { margin: 0; }
    * { font-family: "Noto Sans JP", sans-serif !important; }
  </style>
</head>
<body>${fragment}</body>
</html>`;
}

/**
 * 個人的中率: クライアントが描画した `#hit-rate-pdf-vertical-wrap` の outerHTML を受け取り、
 * Playwright（Chromium）で PDF 化する。
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON ボディが不正です" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("html" in body)) {
    return NextResponse.json({ error: "html フィールドが必要です" }, { status: 400 });
  }

  const html = (body as { html: unknown }).html;
  if (typeof html !== "string" || html.length === 0) {
    return NextResponse.json({ error: "html は空でない文字列にしてください" }, { status: 400 });
  }
  if (html.length > MAX_HTML_CHARS) {
    return NextResponse.json({ error: "html が大きすぎます" }, { status: 413 });
  }

  const { chromium } = await import("playwright");
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--single-process",
      ],
    });
    const page = await browser.newPage();
    const doc = wrapPrintHtml(html);
    await page.setContent(doc, { waitUntil: "load", timeout: 30_000 });
    await Promise.race([
      page.evaluate(() => document.fonts.ready),
      new Promise<void>((r) => setTimeout(r, 12_000)),
    ]).catch(() => undefined);

    const pdf = await page.pdf({
      format: "A4",
      /* 帯・交互行などの背景色を PDF に載せない（紙面は白ベース、罫線・文字はそのまま） */
      printBackground: false,
      margin: { top: "5mm", right: "6mm", bottom: "6mm", left: "6mm" },
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[personal-hit-rate/pdf]", e);
    return NextResponse.json(
      {
        error: `PDF の生成に失敗しました: ${msg}。サーバーに Chromium が入っているか（npx playwright install chromium）、ネットワークで Google Fonts に届くか確認してください。`,
      },
      { status: 500 },
    );
  } finally {
    await browser?.close();
  }
}
