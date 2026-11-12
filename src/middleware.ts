import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
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
    return NextResponse.redirect(url, 308); // 308 Permanent Redirect (preserves HTTP method & path/query)
  }

  return NextResponse.next();
}

export const config = {
  // Run on all requests except internal Next.js static files and images
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
