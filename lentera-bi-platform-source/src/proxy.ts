import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function proxy(req: NextRequest) {
  const token = await getToken({ req });
  if (!token) {
    if (req.nextUrl.pathname === '/api' || req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL('/login', req.url);
    url.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // ponytail: sql-wasm-browser.wasm carve-out is anchored to exact path.
  // Subpaths like /sql-wasm-browser.wasm/foo still go through the auth proxy.
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico|sql-wasm-browser\\.wasm$).*)'],
};
