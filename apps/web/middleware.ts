import { NextRequest, NextResponse } from "next/server";

interface DecodedToken {
  role?: string;
  exp?: number;
}

function decodePayload(token: string | undefined): DecodedToken | null {
  if (!token) return null;
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

const ROLE_HOME: Record<string, string> = {
  PATIENT: "/patient",
  DOCTOR: "/doctor",
  ADMIN: "/admin",
};

/**
 * Route protection per role group. The payload is decoded without verification
 * purely as a routing hint — the API re-checks the bearer token and status on
 * every request, so the real enforcement lives in the backend.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const decoded = decodePayload(request.cookies.get("accessToken")?.value);
  const role = decoded?.role;
  const expired = decoded?.exp ? decoded.exp * 1000 < Date.now() : false;
  const authenticated = Boolean(role && !expired);

  const toSignIn = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  };

  const protectedGroups: { prefix: string; role: string }[] = [
    { prefix: "/patient", role: "PATIENT" },
    { prefix: "/doctor", role: "DOCTOR" },
    { prefix: "/admin", role: "ADMIN" },
  ];

  for (const group of protectedGroups) {
    if (!pathname.startsWith(group.prefix)) continue;
    if (!authenticated) return toSignIn();
    if (role !== group.role) {
      const url = request.nextUrl.clone();
      url.pathname = (role && ROLE_HOME[role]) || "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/consultation")) {
    if (!authenticated || (role !== "PATIENT" && role !== "DOCTOR")) return toSignIn();
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/patient/:path*", "/doctor/:path*", "/admin/:path*", "/consultation/:path*"],
};
