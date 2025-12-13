import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Allow local/dev usage without Supabase configured.
    if (!supabaseUrl || !supabaseAnonKey) {
        return response
    }

    // Create Supabase Client
    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // 🔒 Protected Routes Logic
    // 1. Dashboard and Brain are protected.
    if (request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/syllabus') || request.nextUrl.pathname.startsWith('/practice') || request.nextUrl.pathname.startsWith('/calendar')) {
        if (!user) {
            // Redirect to login if accessing protected route
            return NextResponse.redirect(new URL('/login', request.url))
        }
    }

    // 2. Redirect logged-in users away from /login
    if (request.nextUrl.pathname === '/login') {
        if (user) {
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }
    }

    return response
}
