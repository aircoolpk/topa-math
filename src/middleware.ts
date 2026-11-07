import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/login', '/register']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check for access token
  const token = request.cookies.get('access_token')?.value
    || request.cookies.get('auth_token')?.value

  // Simple check: try to read from localStorage on client side is done via client components
  // For middleware, we just pass through and let client-side check handle redirect
  return NextResponse.next()
}
