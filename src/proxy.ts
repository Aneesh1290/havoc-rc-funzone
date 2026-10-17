import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, verifyToken } from './lib/auth';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect all /admin routes
  if (pathname.startsWith('/admin')) {
    const authCookie = request.cookies.get(AUTH_COOKIE_NAME);

    // If cookie is absent or cryptographic signature is invalid/tampered/expired
    if (!authCookie?.value || !verifyToken(authCookie.value)) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      
      const response = NextResponse.redirect(loginUrl);
      // Clean up invalid cookie if present
      if (authCookie) {
        response.cookies.delete(AUTH_COOKIE_NAME);
      }
      return response;
    }
  }

  // If user is already authenticated and visits /login, redirect to /admin
  if (pathname === '/login') {
    const authCookie = request.cookies.get(AUTH_COOKIE_NAME);
    if (authCookie?.value && verifyToken(authCookie.value)) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};
