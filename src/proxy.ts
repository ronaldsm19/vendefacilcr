import { NextRequest, NextResponse } from "next/server";
import { verifyJwt, COOKIE_NAME } from "@/lib/auth";

export const config = {
  matcher: ["/admin/:path*"],
};

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/admin/login";

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyJwt(token) : null;

  // No sesión → redirigir al login (excepto si ya está en login)
  if (!session && !isLoginPage) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Tiene sesión y está en login → redirigir al dashboard
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}
