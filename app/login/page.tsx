"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "loading" | "login" | "register" | "setup" | "invite" | "unavailable" | "forgot" | "reset";

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
    setInviteToken(token);
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
      if (!response.ok) throw new Error([data.error || "Sign in failed.", data.code ? "Diagnostic: " + data.code : ""].filter(Boolean).join(" — "));
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
    : "Welcome back";

  const description = mode === "setup" ? "Set up the first administrator account."
    : mode === "invite" ? "Complete your account using the invitation from your workspace admin."
    : mode === "register" ? "Create an account first. Full private access is enabled only after your unit details are reviewed by the block administrator."
    : mode === "unavailable" ? "The workspace needs its database connection before you can sign in."
    : mode === "forgot" ? "Enter the email address associated with your ResolveAI account. We will send a one-time reset link if an account exists."
    : mode === "reset" ? "Choose a new password with at least 12 characters. The reset link can be used once and expires after 30 minutes."
    : "Sign in to your ResolveAI account.";

  return <main className="auth-shell">
    <section className="auth-card">
      <div className="auth-brand"><span className="auth-mark">✦</span><span>resolve<strong>ai</strong></span></div>
      <div className="auth-eyebrow">PRIVATE TEAM WORKSPACE</div>
      <h1>{title}</h1>
      <p className="auth-description">{description}</p>
      {mode === "loading" ? <div className="auth-loading">Checking secure workspace…</div> : mode === "unavailable" ? <div className="auth-error">{error}</div> : <form onSubmit={submit} className="auth-form">
        {mode === "setup" || mode === "invite" ? <label>Your name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" required maxLength={80} placeholder="Your name"/></label> : null}
        {mode !== "reset" ? <label>Work email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required maxLength={254} placeholder="you@company.com"/></label> : null}
        {mode !== "forgot" ? <label>{mode === "reset" ? "New password" : "Password"}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={12} maxLength={128} placeholder="At least 12 characters"/></label> : null}
        {mode === "reset" ? <label>Confirm new password<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={12} maxLength={128} placeholder="Enter the new password again"/></label> : null}
        {mode === "setup" ? <>
          <label>Workspace name<input value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} maxLength={80}/></label>
          <label>One-time setup code<input type="password" value={setupToken} onChange={e=>setSetupToken(e.target.value)} required autoComplete="off" placeholder="Cloudflare secret"/></label>
        </> : null}
        {error ? <div className="auth-error" role="alert">{error}</div> : null}
        {notice ? <div className="auth-footnote" role="status">{notice}</div> : null}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "setup" ? "Create administrator account" : mode === "invite" ? "Join workspace" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : mode === "reset" ? "Save new password" : "Sign in"}</button>
      </form>}
      {mode === "login" ? <>
        <button type="button" className="outline-btn" onClick={() => { setMode("forgot"); setError(""); setNotice(""); setPassword(""); }}>Forgot password?</button>
        <button type="button" className="outline-btn" onClick={() => { setMode("register"); setError(""); setNotice(""); }}>Create a public account</button>
      </> : mode === "register" ? <button type="button" className="outline-btn" onClick={() => { setMode("login"); setError(""); setNotice(""); }}>Already have an account? Sign in</button>
      : mode === "forgot" || mode === "reset" ? <button type="button" className="outline-btn" onClick={() => { setMode("login"); setError(""); setNotice(""); setPassword(""); setConfirmPassword(""); setResetToken(""); window.history.replaceState({}, "", "/login/"); }}>Back to sign in</button>
      : null}
      <div className="auth-footnote"><span className="auth-lock">●</span> Public entry · Private access after approval</div>
    </section>
  </main>;
}
