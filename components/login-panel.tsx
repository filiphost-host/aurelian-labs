"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, Mail, X } from "lucide-react";
import { getAuthSignInErrorMessage } from "@/lib/auth-errors";
import { createClient, hasSupabaseEnv } from "@/lib/supabase";
import { BrandMark } from "@/components/brand-mark";

export function LoginPanel({ initialMessage = "" }: { initialMessage?: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sent, setSent] = useState(false);
  const configured = hasSupabaseEnv();

  useEffect(() => {
    if (cooldown === 0) return;

    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function signIn() {
    const supabase = createClient();
    if (!supabase || !email) return;

    setBusy(true);
    const origin = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        shouldCreateUser: false,
      },
    });
    setBusy(false);
    if (error) {
      setMessage(getAuthSignInErrorMessage(error));
      return;
    }

    setCooldown(60);
    setSent(true);
    setMessage("Check your email for the private sign-in link. The newest link is the one to use.");
  }

  return (
    <main className="login-shell">
      <section className={`login-panel${sent ? " login-sent" : ""}`}>
        {sent ? <button className="login-close" onClick={() => setSent(false)} aria-label="Back to sign in"><X size={17} /></button> : null}
        <BrandMark className="login-brand-mark" priority />
        <div className="brand-lock">
          <LockKeyhole size={20} />
          <span>Private workspace</span>
        </div>
        <h1>{sent ? "Check your inbox" : "Aurelian Capital"}</h1>
        <p>{sent ? "We sent a secure sign-in link. Open the newest email to authenticate your account; no numeric code is required." : "Sign in to your portfolio workbench with a secure email link."}</p>

        {sent ? (
          <div className="login-confirmation">
            <div><Mail size={17} /><span>{email}</span><CheckCircle2 size={19} /></div>
            <button onClick={() => { setSent(false); setMessage(""); }}><ArrowLeft size={14} /> Back to sign in</button>
          </div>
        ) : !configured ? (
          <div className="setup-box">
            Preview mode is active. Private sign-in becomes available when the hosted workspace is connected.
          </div>
        ) : (
          <div className="login-form">
            <label htmlFor="email">Email</label>
            <div className="input-row">
              <Mail size={18} />
              <input
                id="email"
                type="email"
                value={email}
                placeholder="you@example.com"
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <button onClick={signIn} disabled={busy || !email || cooldown > 0}>
              {busy ? "Sending..." : cooldown > 0 ? `Send again in ${cooldown}s` : "Send magic link"}
              <ArrowRight size={16} />
            </button>
            {message ? <p className="form-message">{message}</p> : null}
          </div>
        )}
      </section>
    </main>
  );
}
