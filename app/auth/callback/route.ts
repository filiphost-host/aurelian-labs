import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const cookieStore = await cookies();

  if (code && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const loginUrl = new URL("/login", requestUrl.origin);
      loginUrl.searchParams.set("error", "auth_failed");
      return NextResponse.redirect(loginUrl);
    }

    const { data } = await supabase.auth.getUser();
    const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase();
    if (!data.user || (ownerEmail && data.user.email?.toLowerCase() !== ownerEmail)) {
      await supabase.auth.signOut();
      const loginUrl = new URL("/login", requestUrl.origin);
      loginUrl.searchParams.set("error", "owner_only");
      return NextResponse.redirect(loginUrl);
    }

    await supabase.from("profiles").upsert({
      id: data.user.id,
      display_name: "Aurelian Owner",
      base_currency: "NOK",
      updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.redirect(new URL("/", requestUrl.origin));
}
