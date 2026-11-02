"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "loading" | "login" | "setup" | "invite" | "unavailable";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [inviteToken, setInviteToken] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [workspaceName, setWorkspaceName] = useState("My team");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite") || "";
    setInviteToken(token);
    fetch("/api/auth/status", { cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Private workspace is not ready.");
        setMode(token ? "invite" : data.setup_required ? "setup" : "login");
      })
      .catch(reason => { setError(reason instanceof Error ? reason.message : "Cannot connect to ResolveAI."); setMode("unavailable"); });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const endpoint = mode === "setup" ? "/api/auth/setup" : mode === "invite" ? "/api/auth/accept-invite" : "/api/auth/login";
      const payload = mode === "setup"
        ? { email, password, name, workspace_name: workspaceName, setup_token: setupToken }
        : mode === "invite" ? { email, password, name, invite_token: inviteToken } : { email, password };
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sign in failed.");
      router.replace("/");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
    } finally { setBusy(false); }
  }

  return <main className="auth-shell">
    <section className="auth-card">
      <div className="auth-brand"><span className="auth-mark">✦</span><span>resolve<strong>ai</strong></span></div>
      <div className="auth-eyebrow">PRIVATE TEAM WORKSPACE</div>
      <h1>{mode === "setup" ? "Create your workspace" : mode === "invite" ? "Join your team" : mode === "unavailable" ? "Workspace unavailable" : "Welcome back"}</h1>
      <p className="auth-description">{mode === "setup" ? "Set up the owner account. Public registration is disabled." : mode === "invite" ? "Complete your account using the invitation from your workspace admin." : mode === "unavailable" ? "The workspace needs its database connection before you can sign in." : "Sign in to your private ResolveAI workspace."}</p>
      {mode === "loading" ? <div className="auth-loading">Checking secure workspace…</div> : mode === "unavailable" ? <div className="auth-error">{error}</div> : <form onSubmit={submit} className="auth-form">
        {mode === "setup" || mode === "invite" ? <label>Your name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" required maxLength={80} placeholder="Your name"/></label> : null}
        <label>Work email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required maxLength={254} placeholder="you@company.com"/></label>
        <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={12} maxLength={128} placeholder="At least 12 characters"/></label>
        {mode === "setup" ? <>
          <label>Workspace name<input value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} maxLength={80}/></label>
          <label>One-time setup code<input type="password" value={setupToken} onChange={e=>setSetupToken(e.target.value)} required autoComplete="off" placeholder="Cloudflare secret"/></label>
        </> : null}
        {error ? <div className="auth-error" role="alert">{error}</div> : null}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "setup" ? "Create private workspace" : mode === "invite" ? "Join workspace" : "Sign in"}</button>
      </form>}
      <div className="auth-footnote"><span className="auth-lock">●</span> Private access · Invite-only · No public sign-up</div>
    </section>
  </main>;
}
