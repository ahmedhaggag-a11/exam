import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    if (pathname.startsWith('/admin') || pathname.startsWith('/teacher')) {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Fast check: if no Supabase auth token cookie exists, user is unauthenticated
  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some(
    (c) => c.name.includes('sb-') && c.name.includes('-auth-token')
  );

  if (!hasAuthCookie) {
    if (pathname.startsWith('/admin') || pathname.startsWith('/teacher')) {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Safe timeout helper (3000ms max) to prevent Vercel 504 Gateway Timeouts
  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 3000)
    );

    const getUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        return data?.user || null;
      } catch {
        return null;
      }
    };

    const user = await Promise.race([getUser(), timeoutPromise]);

    if (!user && (pathname.startsWith('/admin') || pathname.startsWith('/teacher'))) {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    if (user) {
      const getProfile = async () => {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          return data;
        } catch {
          return null;
        }
      };

      const profile = await Promise.race([getProfile(), timeoutPromise]);
      const role = profile?.role || user.user_metadata?.role || 'teacher';

      if (pathname === '/login' || pathname === '/') {
        url.pathname = role === 'admin' ? '/admin' : '/teacher';
        return NextResponse.redirect(url);
      }

      if (pathname.startsWith('/admin') && role !== 'admin') {
        url.pathname = '/teacher';
        return NextResponse.redirect(url);
      }
    }
  } catch (err) {
    console.error('Middleware execution error:', err);
    if (pathname.startsWith('/admin') || pathname.startsWith('/teacher')) {
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
