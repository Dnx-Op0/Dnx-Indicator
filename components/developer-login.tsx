"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";

export default function DeveloperLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
  }, []);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/owner/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json() as { error?: string; authenticated?: boolean };
      if (!response.ok || !result.authenticated) throw new Error(result.error ?? "Developer sign-in failed.");
      setPassword("");
      router.replace("/developer");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Developer sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="developer-login-screen">
    <div className="developer-login-glow" />
    <section className="developer-login-card">
      <Link className="developer-login-brand" href="/">
        <span className="developer-brand-mark">DNX</span>
        <span><b>DNX INDICATES</b><small>Developer access</small></span>
      </Link>
      <div className="developer-login-heading">
        <span className="developer-login-icon"><LockKeyhole size={19} /></span>
        <div className="eyebrow">PRIVATE WORKSPACE</div>
        <h1>Developer sign in</h1>
        <p>Sign in to manage DNX demo-company information.</p>
      </div>
      <form className="developer-login-form" onSubmit={signIn}>
        <label>Developer email<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<span className="developer-password-input"><input type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></span></label>
        {error && <div className="developer-login-error" role="alert">{error}</div>}
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in securely"} <ArrowUpRight size={15} /></button>
      </form>
      <div className="developer-login-security"><ShieldCheck size={15} /><span>Developer access is protected by a signed, HttpOnly session. Public financial data remains demo-only.</span></div>
      <Link className="developer-login-back" href="/"><ArrowLeft size={14} /> Return to the free public dashboard</Link>
    </section>
  </main>;
}
