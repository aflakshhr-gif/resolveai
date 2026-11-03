"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Bell, BookOpen, Check, ChevronDown, ChevronRight, Inbox, LayoutDashboard, LifeBuoy, MessageCircle, MoreHorizontal, Search, Send, Settings, Sparkles, Users } from "lucide-react";

type AiInsight = { sentiment: string; urgency: string; intent: string; suggested_reply: string; next_step: string; mode?: string; disclaimer?: string };

type Ticket = { id: string; name: string; email: string; initials: string; subject: string; preview: string; time: string; status: "Open" | "Pending" | "Resolved"; tag: string; messages: { from: "customer" | "agent"; text: string; time: string }[] };

const initialTickets: Ticket[] = [];



function TeamPanel() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function invite() {
    setBusy(true); setError(""); setInviteUrl("");
    try {
      const response = await fetch("/api/auth/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, role }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create invitation.");
      setInviteUrl(data.invite_url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create invitation."); }
    finally { setBusy(false); }
  }
  return <div className="content-page"><div className="eyebrow">PRIVATE WORKSPACE</div><h1>Team</h1><p>Invite people you trust. New members can join only with a one-time invitation link.</p><div className="team-invite-card"><b>Invite a teammate</b><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="teammate@company.com"/></label><label>Workspace role<select value={role} onChange={e=>setRole(e.target.value)}><option value="agent">Agent</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select></label><button className="primary-btn" onClick={invite} disabled={busy||!email.trim()}>{busy?"Creating invite…":"Create invitation link"}</button>{error&&<div className="ai-error">{error}</div>}{inviteUrl&&<div className="invite-result"><b>Invitation link</b><input readOnly value={inviteUrl}/><button className="outline-btn" onClick={()=>navigator.clipboard.writeText(inviteUrl)}>Copy link</button><small>Share this link only with the invited person. It expires after 7 days and can be used once.</small></div>}</div></div>;
}

export default function Home() {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [selected, setSelected] = useState("");
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [apiError, setApiError] = useState("");
  const [userEmail, setUserEmail] = useState("Loading account…");
  const [workspaceName, setWorkspaceName] = useState("Private workspace");
  const [userRole, setUserRole] = useState("Member");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [section, setSection] = useState("Inbox");
  const [notice, setNotice] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [aiError, setAiError] = useState("");
  async function loadConversations() {
    const response = await fetch("/api/conversations?refresh=" + Date.now(), {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load conversations.");
    const mapped: Ticket[] = (data.conversations || []).map((item: any) => ({
      id: String(item.id),
      name: item.customer_name,
      email: item.customer_email || "",
      initials: String(item.customer_name || "?").split(/\s+/).slice(0,2).map((part: string) => part[0] || "").join("").toUpperCase(),
      subject: item.subject,
      preview: item.preview || "",
      time: item.updated_at ? new Date(item.updated_at).toLocaleString() : "",
      status: item.status === "resolved" ? "Resolved" : item.status === "pending" ? "Pending" : "Open",
      tag: item.tag || "General",
      messages: (item.messages || []).map((message: any) => ({ from: message.author_type === "agent" ? "agent" : "customer", text: message.body, time: message.created_at ? new Date(message.created_at).toLocaleTimeString() : "" }))
    }));
    setTickets(mapped);
    setSelected(current => mapped.some(ticket => ticket.id === current) ? current : mapped[0]?.id || "");
  }
  useEffect(() => {
    let active = true;
    loadConversations().catch(reason => { if (active) setApiError(reason instanceof Error ? reason.message : "Could not load conversations."); }).finally(() => { if (active) setLoadingTickets(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", {
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(10000)
    })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load account.");
        if (!active) return;
        setUserEmail(data.user?.email || "Account");
        setWorkspaceName(data.workspace?.name || "Private workspace");
        setUserRole(data.role || "Member");
      })
      .catch(() => {
        if (active) setUserEmail("Account details unavailable");
      });
    return () => { active = false; };
  }, []);
  const active = tickets.find(t => t.id === selected) ?? tickets[0] ?? { id: "", name: "", email: "", initials: "?", subject: "No conversations yet", preview: "", time: "", status: "Open" as const, tag: "General", messages: [] };
  const filtered = useMemo(() => tickets.filter(t => (filter === "All" || t.status === filter) && (!query || [t.name, t.subject, t.preview].some(v => v.toLowerCase().includes(query.toLowerCase())))), [tickets, filter, query]);
  function flash(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 2200); }
  async function createConversation() {
    try {
      const response = await fetch("/api/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customer_name: customerName, customer_email: customerEmail, subject: newSubject, message: firstMessage }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create conversation.");
      setShowNewConversation(false); setCustomerName(""); setCustomerEmail(""); setNewSubject(""); setFirstMessage("");
      setSelected(data.id); await loadConversations(); flash("Conversation saved");
    } catch (reason) { flash(reason instanceof Error ? reason.message : "Could not create conversation."); }
  }
  async function analyzeConversation() {
    setAiLoading(true); setAiError(""); setAiInsight(null);
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject: active.subject, messages: active.messages }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI analysis failed.");
      setAiInsight(data as AiInsight);
    } catch (error) { setAiError(error instanceof Error ? error.message : "AI analysis failed."); }
    finally { setAiLoading(false); }
  }
  async function sendReply() {
    if (!draft.trim() || !active.id) return;
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(active.id)}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: draft.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Reply could not be saved.");
      setTickets(old => old.map(t => t.id === selected ? { ...t, status: "Pending", preview: draft.trim(), messages: [...t.messages, { from: "agent", text: draft.trim(), time: new Date().toLocaleTimeString() }] } : t));
      setDraft(""); flash("Reply saved to the workspace");
    } catch (reason) { flash(reason instanceof Error ? reason.message : "Reply could not be saved."); }
  }
  const nav = [{ label: "Workspace", items: [{ name: "Inbox", icon: Inbox }] }, { label: "Manage", items: [{ name: "Team", icon: Users }] }];
  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark"><LifeBuoy size={19}/></span><b>resolve<span>ai</span></b></div><button className="workspace-switch"><span className="workspace-avatar">{workspaceName.slice(0,1).toUpperCase()}</span><span><b>{workspaceName}</b><small>Private workspace</small></span><ChevronDown size={15}/></button>
      {nav.map(group => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(item => <button key={item.name} className={section === item.name ? "nav-item active" : "nav-item"} onClick={() => setSection(item.name)}><item.icon size={17}/>{item.name}</button>)}</div>)}
      
      <div className="sidebar-bottom"><div className="usage-card"><b><Sparkles size={13}/> Private workspace</b><small>Team-only access is enabled</small></div><div className="user-row"><div className="avatar">{userEmail.slice(0,2).toUpperCase()}</div><span><b>{userEmail}</b><small>{userRole}</small></span><MoreHorizontal size={17}/></div></div>
    </aside>
    <section className="main-area"><header className="topbar"><div className="breadcrumbs">Workspace <ChevronRight size={14}/><b>{section}</b></div><div className="top-actions"><label className="search-global"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search conversations..."/></label><button className="icon-btn" onClick={() => flash("You're all caught up")}><Bell size={18}/></button><button className="outline-btn" onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});window.location.href="/login/";}}>Sign out</button><div className="avatar">JD</div></div></header>
      {section === "Inbox" ? <div className="inbox-layout"><section className="inbox-list"><div className="page-heading"><div className="eyebrow">CUSTOMER SUPPORT</div><h1>Inbox <span className="count">{tickets.length}</span></h1><p>Manage and resolve customer conversations.</p><button className="primary-btn new-conversation-toggle" onClick={()=>setShowNewConversation(value=>!value)}>New conversation</button>{showNewConversation && <div className="new-conversation-form"><input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Customer name"/><input type="email" value={customerEmail} onChange={e=>setCustomerEmail(e.target.value)} placeholder="Customer email (optional)"/><input value={newSubject} onChange={e=>setNewSubject(e.target.value)} placeholder="Subject"/><textarea value={firstMessage} onChange={e=>setFirstMessage(e.target.value)} placeholder="First customer message (optional)"/><button className="primary-btn" disabled={!customerName.trim()||!newSubject.trim()} onClick={createConversation}>Create conversation</button></div>}</div><div className="tabs">{["All","Open","Pending","Resolved"].map(f => <button key={f} className={filter === f ? "tab active-tab" : "tab"} onClick={() => setFilter(f)}>{f}</button>)}</div><div className="conversation-list">{filtered.map(t => <button key={t.id} className={selected === t.id ? "conversation selected" : "conversation"} onClick={() => setSelected(t.id)}><div className="avatar">{t.initials}</div><div className="conversation-main"><div className="conversation-top"><b>{t.name}</b><time>{t.time}</time></div><strong>{t.subject}</strong><p>{t.preview}</p><small className="tag">{t.tag}</small></div></button>)}{filtered.length === 0 && <p className="empty-state">{loadingTickets ? "Loading conversations…" : apiError || "No conversations yet. Create one to get started."}</p>}</div></section>
      <section className="conversation-detail"><div className="detail-header"><div className="avatar">{active.initials}</div><div className="detail-person"><b>{active.subject}</b><small>{active.name} · {active.email}</small></div><button className="outline-btn" disabled={!active.id} onClick={async () => { const next = active.status === "Resolved" ? "open" : "resolved"; const response = await fetch(`/api/conversations/${encodeURIComponent(active.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) }); if (!response.ok) { const data = await response.json(); flash(data.error || "Status update failed."); return; } setTickets(old => old.map(t => t.id === selected ? { ...t, status: next === "resolved" ? "Resolved" : "Open" } : t)); flash("Conversation status saved"); }}>{active.status === "Resolved" ? "Reopen" : "Resolve"}</button></div><div className="detail-subbar"><span className={"status-pill " + active.status.toLowerCase()}>{active.status}</span><span>· {active.tag}</span><span>· Assigned to you</span></div><div className="thread"><div className="thread-date">Today · Conversation</div>{active.messages.map((m,i) => <div className={"message-row " + (m.from === "agent" ? "from-agent" : "")} key={i}><div className="message-content"><div className="message-meta"><b>{m.from === "agent" ? "Jordan Davis" : active.name}</b><time>{m.time}</time></div><div className="message-bubble">{m.text}</div></div></div>)}<div className="reply-box"><div className="reply-mode"><MessageCircle size={14}/> Reply <span>Saved internally · not delivered</span></div><textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a reply..."/><div className="reply-tools"><small>{aiInsight ? "AI-assisted draft · Review before sending" : "AI Copilot · Draft mode"}</small><button className="primary-btn" onClick={sendReply} disabled={!active.id || !draft.trim()}>Save reply <Send size={14}/></button></div></div></div></section>
      <aside className="copilot-panel"><div className="copilot-heading"><span className="copilot-icon"><Sparkles size={17}/></span><div><b>AI Copilot</b><small>Here to help you resolve faster</small></div></div><div className="demo-banner live-ai-banner">Free offline demo · Rule-based suggestions only (not a language model). Review every draft before sending.</div><button className="primary-btn ai-analyze-btn" onClick={analyzeConversation} disabled={aiLoading || !active.id}>{aiLoading ? "Analyzing..." : "Analyze conversation"} <Sparkles size={14}/></button>{aiError && <div className="ai-error" role="alert">{aiError}</div>}{aiInsight ? <><div className="insight-card"><b>Customer sentiment</b><span>{aiInsight.sentiment}</span></div><div className="insight-card"><b>Urgency</b><span>{aiInsight.urgency}</span></div><div className="insight-card"><b>Detected intent</b><span>{aiInsight.intent}</span></div><div className="copilot-tip"><b>Next step</b><br/>{aiInsight.next_step}</div><div className="ai-draft"><b>Suggested reply</b><p>{aiInsight.suggested_reply}</p>{aiInsight.disclaimer && <small>{aiInsight.disclaimer}</small>}<button className="outline-btn" onClick={() => setDraft(aiInsight.suggested_reply)}>Use this draft</button></div></> : <div className="copilot-tip">Select “Analyze conversation” for a free, rule-based demo analysis. It does not use a paid AI API.</div>}</aside></div> : section === "Team" ? <TeamPanel /> : <div className="content-page"><div className="eyebrow">RESOLVEAI WORKSPACE</div><h1>{section}</h1><p>This section is part of the ResolveAI starter dashboard.</p><div className="placeholder-card"><Sparkles size={22}/><b>{section}</b><span>Choose Inbox to return to customer conversations.</span><button className="primary-btn" onClick={() => setSection("Inbox")}>Open inbox</button></div></div>}
      {notice && <div className="toast"><Check size={16}/>{notice}</div>}
    </section>
  </main>;
}
