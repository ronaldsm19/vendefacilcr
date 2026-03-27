import { NextResponse } from "next/server";
import { SUPERADMIN_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SUPERADMIN_COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return response;
}
