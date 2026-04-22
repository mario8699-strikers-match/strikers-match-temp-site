import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected paths that should never be indexed by search engines
const NOINDEX_PATHS = [
  '/profile',
  '/fighter/profile',
  '/promoter/dashboard',
  '/manager/dashboard',
  '/manager/profile',
  '/sponsor/dashboard',
  '/consent',
  '/events/create',
  '/reset-password',
  '/admin',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = NOINDEX_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  if (isProtected) {
    const response = NextResponse.next();
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|json|xml|txt|webmanifest)).*)',
  ],
};
