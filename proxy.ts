import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected paths that should never be indexed by search engines
const NOINDEX_PATHS = [
  '/profile',
  '/fighter/profile',
  '/fighter/matches',
  '/promoter/analytics',
  '/promoter/dashboard',
  '/manager/dashboard',
  '/manager/profile',
  '/sponsor/dashboard',
  '/spectator/dashboard',
  '/vendor/profile',
  '/consent',
  '/events/create',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/pricing/success',
  '/search',
  '/admin',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = NOINDEX_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  ) || /^\/events\/[^/]+\/manage(?:\/|$)/.test(pathname);

  if (isProtected) {
    const response = NextResponse.next();
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|json|xml|txt|webmanifest)).*)',
  ],
};
