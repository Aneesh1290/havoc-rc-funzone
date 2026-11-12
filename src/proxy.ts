import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, verifyToken } from './lib/auth';

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const cleanHost = host.toLowerCase().split(':')[0]; // remove port if present

  // Redirect any visits from havocrcfunzone.com, www.havocrcfunzone.com, or www.havocrcfunzone.in to havocrcfunzone.in
  if (
    cleanHost === 'havocrcfunzone.com' ||
    cleanHost === 'www.havocrcfunzone.com' ||
    cleanHost === 'www.havocrcfunzone.in'
  ) {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    url.host = 'havocrcfunzone.in';
    url.port = '';
    return NextResponse.redirect(url, 308); // 308 Permanent Redirect
  }

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
