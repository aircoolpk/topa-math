import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const path = typeof body.path === 'string' && body.path.startsWith('/') ? body.path : '/'
    revalidatePath(path)
    return NextResponse.json({ revalidated: true, path }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to revalidate'
    return NextResponse.json({ revalidated: false, error: message }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
