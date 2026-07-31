import { NextResponse } from "next/server";
import { z } from "zod";
import { createShareToken, hashShareToken } from "@/lib/share-tokens";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const shareSchema = z.object({
  title: z.string().trim().min(1).max(120),
  kind: z.enum(["insight", "scenario"]),
  expiresInDays: z.number().int().min(1).max(30).default(7),
  options: z.object({
    includeHoldings: z.boolean(),
    includeValues: z.boolean(),
    includeCommentary: z.boolean(),
  }),
  content: z.record(z.string(), z.unknown()),
});

async function authenticatedUser() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function GET() {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ message: "Private storage is not configured." }, { status: 503 });

  const { data, error } = await admin
    .from("share_snapshots")
    .select("id,title,kind,expires_at,revoked_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ shares: data ?? [] });
}

export async function POST(request: Request) {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ message: "Private storage is not configured." }, { status: 503 });

  const parsed = shareSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "The share selection is incomplete." }, { status: 400 });
  }

  const token = createShareToken();
  const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 86_400_000).toISOString();
  const payload = {
    title: parsed.data.title,
    kind: parsed.data.kind,
    createdAt: new Date().toISOString(),
    expiresAt,
    options: { ...parsed.data.options, expiresInDays: parsed.data.expiresInDays },
    content: parsed.data.content,
  };

  const { error } = await admin.from("share_snapshots").insert({
    user_id: user.id,
    token_hash: hashShareToken(token),
    title: parsed.data.title,
    kind: parsed.data.kind,
    payload,
    expires_at: expiresAt,
  });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const origin = new URL(request.url).origin;
  return NextResponse.json({ url: `${origin}/share/${token}`, expiresAt });
}

export async function DELETE(request: Request) {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ message: "Private storage is not configured." }, { status: 503 });

  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return NextResponse.json({ message: "Invalid share identifier." }, { status: 400 });
  const { error } = await admin
    .from("share_snapshots")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ revoked: true });
}
