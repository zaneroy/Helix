import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const publicPages = [
    "/admin/login",
    "/employee/login",
    "/investor/login",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
  ];

  if (publicPages.some((page) => path === page || path.startsWith(`${page}/`))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedRoutes = [
    { prefix: "/dashboard", role: "admin", login: "/admin/login" },
    { prefix: "/employee", role: "employee", login: "/employee/login" },
    { prefix: "/investor", role: "investor", login: "/investor/login" },
  ];

  const route = protectedRoutes.find(
    (r) => path === r.prefix || path.startsWith(`${r.prefix}/`)
  );

  if (!route) return response;

  if (!user) {
    return NextResponse.redirect(new URL(route.login, request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== route.role) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL(route.login, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/employee/:path*", "/investor/:path*"],
};