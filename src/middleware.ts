import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  if (token?.needsRoleSelection && pathname !== "/select-role") {
    return NextResponse.redirect(new URL("/select-role", req.url));
  }

  if (!token?.needsRoleSelection && pathname === "/select-role") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/quiz/:path*", "/play/:path*", "/results/:path*", "/select-role"],
};
