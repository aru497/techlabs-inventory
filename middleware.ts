import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, sessionToken } from '@/lib/auth';

// Gate the whole app behind the admin session. Public: the login page + its API.
const PUBLIC = ['/login', '/api/login', '/api/logout'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE)?.value;
  const ok = token && token === (await sessionToken());
  if (ok) return NextResponse.next();

  // API calls get a clean 401; pages redirect to the login screen.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname !== '/' ? `?from=${encodeURIComponent(pathname)}` : '';
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
