import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/http";

/** 現在のブラウザが管理者かどうか */
export async function GET() {
  const admin = await isAdminRequest();
  return NextResponse.json({ admin });
}
