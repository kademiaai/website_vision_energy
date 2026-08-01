import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // QUAN TRỌNG: Dùng getUser() thay vì getSession() để đảm bảo tính xác thực
  const { data: { user } } = await supabase.auth.getUser()

  // Nếu truy cập /admin mà không có user -> Đá về /login
  if (request.nextUrl.pathname.startsWith('/admin') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // /api/analytics/* is server-side aggregation for the admin-only "Phân
  // tích & Insights" section — same guard as /admin/*, but a 401 JSON
  // response instead of a redirect since callers are fetch(), not browsers.
  if (request.nextUrl.pathname.startsWith('/api/analytics') && !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Nếu đã login mà cố vào /login -> Đá sang /admin
  if (request.nextUrl.pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/login', '/api/analytics/:path*'],
}