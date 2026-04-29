"use client";

import NextLink from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { useGlobalBusy } from "@/components/GlobalBusyProvider";

type Props = ComponentProps<typeof NextLink>;

function isProbablyExternalHref(href: Props["href"]): boolean {
  if (typeof href !== "string") return false;
  return /^https?:\/\//i.test(href) || href.startsWith("mailto:");
}

/** 内部ルート用 Link。クリックでグローバルオーバーレイ付き transition で遷移する */
export default function AppLink({
  href,
  replace: replaceNav,
  scroll,
  prefetch,
  onClick,
  ...rest
}: Props) {
  const { push, replace } = useGlobalBusy();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const tgt = rest.target;
    if (tgt && tgt !== "_self") return;
    if ("download" in rest && rest.download !== undefined && rest.download !== false) return;

    if (typeof href === "string" && isProbablyExternalHref(href)) return;

    e.preventDefault();
    const navHref = href as Parameters<typeof push>[0];
    if (replaceNav) replace(navHref);
    else push(navHref);
  };

  return (
    <NextLink
      href={href}
      replace={replaceNav}
      scroll={scroll}
      prefetch={prefetch}
      onClick={handleClick}
      {...rest}
    />
  );
}
