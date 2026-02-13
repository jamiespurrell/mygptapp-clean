import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth as authJsAuth } from './auth';
import { getAuthProvider } from './lib/auth/provider';

const clerk = clerkMiddleware();

export default async function middleware(req: NextRequest) {
  if (getAuthProvider() === 'clerk') {
    return clerk(req);
  }


  const isPublicAuthRoute = req.nextUrl.pathname.startsWith('/sign-in')
    || req.nextUrl.pathname.startsWith('/sign-up')
    || req.nextUrl.pathname.startsWith('/api/auth');

  if (isPublicAuthRoute) {
    return NextResponse.next();
  }

  const session = await authJsAuth();
  if (!session?.user?.id) {
    if (req.nextUrl.pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const signInUrl = new URL('/sign-in', req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
