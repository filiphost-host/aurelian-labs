import { streamText } from "ai";
import { NextResponse } from "next/server";
import { analystPacketSchema, packetToText } from "@/lib/ai-packet";
import { analystInstructions, analystPrompt } from "@/lib/ai-prompts";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Read once here so the model in use is visible in one place rather than inline.
const analystModel = process.env.AI_ANALYST_MODEL ?? "anthropic/claude-sonnet-5";

/**
 * A deployment on Vercel is issued an OIDC token that the gateway accepts, so an
 * explicit key is only needed when running elsewhere.
 */
function hasGatewayCredentials() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

export async function POST(request: Request) {
  // This route spends money per call, so it checks the session itself rather than
  // relying only on the proxy, which waves everything through when Supabase is
  // unconfigured.
  const supabase = await createServerSupabaseClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  if (!hasGatewayCredentials()) {
    return NextResponse.json({
      message: "The AI analyst is not connected. Add an AI Gateway key to switch it on.",
    }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = analystPacketSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({
      message: first
        ? `That packet was rejected: ${first.path.join(".") || "packet"} — ${first.message}.`
        : "That packet does not match what this endpoint accepts.",
    }, { status: 400 });
  }

  const packet = parsed.data;
  // No tools are provided on purpose: the packet is the model's only source.
  const result = streamText({
    model: analystModel,
    instructions: analystInstructions(packet.mode),
    prompt: analystPrompt(packet, packetToText(packet)),
    temperature: 0.3,
    // Closing the dialog or the tab stops the generation, and the billing with it.
    abortSignal: request.signal,
  });

  // The response headers are sent before the model produces anything, so a failure
  // part way through cannot become a status code. It is written into the text
  // instead, because a silently truncated answer is worse than a stated failure.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of result.stream) {
          if (part.type === "text-delta") controller.enqueue(encoder.encode(part.text));
          else if (part.type === "error") {
            console.error("[ai/analyst] stream error", part.error);
            controller.enqueue(encoder.encode(
              "\n\n[The analyst stopped early and this answer is incomplete. Nothing was saved.]",
            ));
            break;
          }
        }
      } catch (error) {
        // Enqueueing throws once the client has gone away, which is expected.
        if (!request.signal.aborted) console.error("[ai/analyst] stream failed", error);
        try {
          controller.enqueue(encoder.encode(
            "\n\n[The analyst could not be reached and this answer is incomplete. Nothing was saved.]",
          ));
        } catch { /* the client is already gone */ }
      } finally {
        try { controller.close(); } catch { /* already closed by the cancelled stream */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
