"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowUpRight, CheckCircle2, Inbox, LifeBuoy, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

type Mode = "loading" | "login" | "register" | "setup" | "invite" | "unavailable" | "forgot" | "reset" | "verify_pending" | "verify_email";

async function readApiJson(response: Response): Promise<any> {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    const status = response.status ? ` (HTTP ${response.status})` : "";
    throw new Error(`The server returned an unexpected response${status}. Please retry; the sign-in service may be temporarily unavailable.`);
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [inviteToken, setInviteToken] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [workspaceName, setWorkspaceName] = useState("My team");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite") || "";
    const passwordResetToken = params.get("reset_token") || "";
    const emailVerificationToken = params.get("verify_token") || "";
    setInviteToken(token);
    if (emailVerificationToken) {
      setVerificationToken(emailVerificationToken);
      setMode("verify_email");
      window.history.replaceState({}, "", "/login/");
      return;
    }
    if (passwordResetToken) {
      setResetToken(passwordResetToken);
      setMode("reset");
      // Keep the one-time credential out of the address bar after hydration.
      window.history.replaceState({}, "", "/login/");
      return;
    }
    fetch("/api/auth/status", { cache: "no-store", signal: AbortSignal.timeout(12000) })
      .then(async response => {
        const data = await readApiJson(response);
        if (!response.ok) throw new Error(data.error || "Private workspace is not ready.");
        setMode(token ? "invite" : data.setup_required ? "setup" : "login");
      })
      .catch(reason => {
        setError(reason instanceof Error ? reason.message : "Cannot reach the workspace status service.");
        // Keep the existing-account sign-in form available even when the
        // optional bootstrap/status probe times out.
        setMode(token ? "unavailable" : "login");
      });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      if (mode === "verify_email") {
        const response = await fetch("/api/auth/email-verification/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: verificationToken }),
          credentials: "same-origin"
        });
        const data = await readApiJson(response);
        if (!response.ok) throw new Error(data.error || "Could not verify this email address.");
        setVerificationToken("");
        router.replace("/membership/");
        router.refresh();
        return;
      }

      if (mode === "verify_pending") {
        const response = await fetch("/api/auth/email-verification/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
          credentials: "same-origin"
        });
        const data = await readApiJson(response);
        if (!response.ok) throw new Error(data.error || "Could not request another verification email.");
        setNotice(data.message || "If this account requires email verification, a new link will be sent shortly.");
        return;
      }

      if (mode === "forgot") {
        const response = await fetch("/api/auth/password-reset/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
          credentials: "same-origin"
        });
        const data = await readApiJson(response);
        if (!response.ok) throw new Error(data.error || "Could not request a password reset.");
        setNotice(data.message || "If an account exists for that email, a reset link will be sent shortly.");
        return;
      }

      if (mode === "reset") {
        if (password !== confirmPassword) throw new Error("The two passwords do not match.");
        const response = await fetch("/api/auth/password-reset/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: resetToken, password }),
          credentials: "same-origin"
        });
        const data = await readApiJson(response);
        if (!response.ok) throw new Error(data.error || "Could not update your password.");
        setPassword("");
        setConfirmPassword("");
        setResetToken("");
        window.history.replaceState({}, "", "/login/");
        setMode("login");
        setNotice(data.message || "Your password has been updated. Please sign in with your new password.");
        return;
      }

      const endpoint = mode === "setup" ? "/api/auth/setup" : mode === "invite" ? "/api/auth/accept-invite" : mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload = mode === "setup"
        ? { email, password, name, workspace_name: workspaceName, setup_token: setupToken }
        : mode === "invite" ? { email, password, name, invite_token: inviteToken } : { email, password };
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), credentials: "same-origin" });
      const data = await readApiJson(response);
      if (!response.ok && data.code === "EMAIL_NOT_VERIFIED") {
        setMode("verify_pending");
        setNotice(data.error || "Verify your email address before signing in.");
        return;
      }
      if (!response.ok) throw new Error([data.error || "Sign in failed.", data.code ? "Diagnostic: " + data.code : ""].filter(Boolean).join(" — "));
      if (mode === "register" && data.requires_email_verification) {
        setMode("verify_pending");
        setNotice(data.message || "Check your inbox for a verification link. You must verify your email before signing in.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "setup" ? "Create your workspace"
    : mode === "invite" ? "Join your team"
    : mode === "register" ? "Create your account"
    : mode === "unavailable" ? "Workspace unavailable"
    : mode === "forgot" ? "Forgot your password?"
    : mode === "reset" ? "Create a new password"
    : mode === "verify_pending" ? "Verify your email"
    : mode === "verify_email" ? "Confirm your email address"
    : "Welcome back";

  const description = mode === "setup" ? "Set up the first administrator account."
    : mode === "invite" ? "Complete your account using the invitation from your workspace admin."
    : mode === "register" ? "Create an account first. Full private access is enabled only after your unit details are reviewed by the block administrator."
    : mode === "unavailable" ? "The workspace needs its database connection before you can sign in."
    : mode === "forgot" ? "Enter the email address associated with your ResolveAI account. We will send a one-time reset link if an account exists."
    : mode === "reset" ? "Choose a new password with at least 12 characters. The reset link can be used once and expires after 30 minutes."
    : mode === "verify_pending" ? "Your account has been created. Open the verification link in your email to activate it, or request a new link below."
    : mode === "verify_email" ? "Confirm that you own this email address. The link can be used once and expires after 24 hours."
    : "Sign in to your ResolveAI account.";

  return <main className="auth-shell rx-auth-shell">
    <div className="rx-auth-glow rx-auth-glow-one" aria-hidden="true" />
    <div className="rx-auth-glow rx-auth-glow-two" aria-hidden="true" />
    <div className="rx-auth-layout">
      <aside className="rx-auth-story">
        <a href="/website/" className="rx-auth-brand">
          <span className="rx-auth-brand-mark"><LifeBuoy size={20}/></span>
          <span>Resolve<span>AI</span></span>
        </a>
        <div className="rx-auth-story-copy">
          <div className="rx-auth-kicker"><span/> PRIVATE TEAM WORKSPACE</div>
          <h2>Good support starts with <em>shared context.</em></h2>
          <p>Sign in to your team workspace to review conversations, keep progress clear and leave useful notes for the people working alongside you.</p>
          <div className="rx-auth-points">
            <div><span><Inbox size={16}/></span><div><b>One shared workspace</b><small>Keep conversations and context together.</small></div></div>
            <div><span><Activity size={16}/></span><div><b>Clear next steps</b><small>Keep the status and handoff visible.</small></div></div>
            <div><span><ShieldCheck size={16}/></span><div><b>Access with approval</b><small>Private team areas are protected.</small></div></div>
          </div>
        </div>
        <div className="rx-auth-story-foot"><LockKeyhole size={14}/> Private access · Reviewed membership</div>
        <div className="rx-auth-decoration" aria-hidden="true"><div/><div/><div/></div>
      </aside>
      <section className="auth-card rx-auth-card">
      <div className="auth-card-brand">
        <span className="auth-card-mark"><LifeBuoy size={18}/></span>
        <span>Resolve<span>AI</span></span>
      </div>
      <div className="rx-auth-form-kicker"><span/> SECURE ACCOUNT ACCESS</div>
      <h1>{title}</h1>
      <p className="auth-description">{description}</p>
      {mode === "loading" ? <div className="auth-loading">Checking secure workspace…</div> : mode === "unavailable" ? <div className="auth-error">{error}</div> : <form onSubmit={submit} className="auth-form">
        {mode === "setup" || mode === "invite" ? <label>Your name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" required maxLength={80} placeholder="Your name"/></label> : null}
        {mode !== "reset" && mode !== "verify_email" ? <label>Work email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required maxLength={254} placeholder="you@company.com"/></label> : null}
        {!["forgot","reset","verify_email","verify_pending"].includes(mode) ? <label>{mode === "reset" ? "New password" : "Password"}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={12} maxLength={128} placeholder="At least 12 characters"/></label> : null}
        {mode === "reset" ? <label>Confirm new password<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={12} maxLength={128} placeholder="Enter the new password again"/></label> : null}
        {mode === "setup" ? <>
          <label>Workspace name<input value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} maxLength={80}/></label>
          <label>One-time setup code<input type="password" value={setupToken} onChange={e=>setSetupToken(e.target.value)} required autoComplete="off" placeholder="Cloudflare secret"/></label>
        </> : null}
        {error ? <div className="auth-error" role="alert">{error}</div> : null}
        {notice ? <div className="auth-footnote" role="status">{notice}</div> : null}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "setup" ? "Create administrator account" : mode === "invite" ? "Join workspace" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : mode === "reset" ? "Save new password" : mode === "verify_pending" ? "Resend verification email" : mode === "verify_email" ? "Verify email address" : "Sign in"}</button>
      </form>}
      {mode === "login" ? <>
        <button type="button" className="outline-btn" onClick={() => { setMode("forgot"); setError(""); setNotice(""); setPassword(""); }}>Forgot password?</button>
        <button type="button" className="outline-btn" onClick={() => { setMode("register"); setError(""); setNotice(""); }}>Create a public account</button>
      </> : mode === "register" ? <button type="button" className="outline-btn" onClick={() => { setMode("login"); setError(""); setNotice(""); }}>Already have an account? Sign in</button>
      : mode === "forgot" || mode === "reset" || mode === "verify_pending" || mode === "verify_email" ? <button type="button" className="outline-btn" onClick={() => { setMode("login"); setError(""); setNotice(""); setPassword(""); setConfirmPassword(""); setResetToken(""); setVerificationToken(""); window.history.replaceState({}, "", "/login/"); }}>Back to sign in</button>
      : null}
      <div className="auth-footnote rx-auth-footnote"><span className="auth-lock">●</span> Public entry · Private access after approval</div>
      <a href="/website/" className="rx-auth-backlink">Explore ResolveAI <ArrowUpRight size={13}/></a>
    </section>
    </div>
  </main>;
}
