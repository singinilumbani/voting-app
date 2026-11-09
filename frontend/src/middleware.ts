import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (request.cookies.has("host_session")) return NextResponse.next();
  const landingPage = request.nextUrl.clone();
  landingPage.pathname = "/";
  landingPage.search = "";
  return NextResponse.redirect(landingPage);
}

export const config = {
  matcher: ["/host/:path*"],
};
