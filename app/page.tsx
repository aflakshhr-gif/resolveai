"use client";

import { useMemo, useState } from "react";
import { Activity, Bell, BookOpen, Check, ChevronDown, ChevronRight, Inbox, LayoutDashboard, LifeBuoy, MessageCircle, MoreHorizontal, Search, Send, Settings, Sparkles, Users } from "lucide-react";

type AiInsight = { sentiment: string; urgency: string; intent: string; suggested_reply: string; next_step: string; mode?: string; disclaimer?: string };

type Ticket = { id: number; name: string; email: string; initials: string; subject: string; preview: string; time: string; status: "Open" | "Pending" | "Resolved"; tag: string; messages: { from: "customer" | "agent"; text: string; time: string }[] };

const initialTickets: Ticket[] = [
  { id: 1, name: "Olivia Rhye", email: "olivia@acme.co", initials: "OR", subject: "Issue with my recent order", preview: "I haven't received a tracking update yet...", time: "2m", status: "Open", tag: "Shipping", messages: [{ from: "customer", text: "Hi team, I placed an order three days ago and haven't received a tracking update yet. Could you help me check what's happening?", time: "10:42 AM" }, { from: "agent", text: "Hi Olivia! Thanks for reaching out. I'm happy to look into this for you.", time: "10:46 AM" }] },
  { id: 2, name: "Phoenix Baker", email: "phoenix@startup.io", initials: "PB", subject: "Can't access my account", preview: "The password reset link seems to be expired...", time: "18m", status: "Open", tag: "Account", messages: [{ from: "customer", text: "The password reset link seems to be expired. I've tried twice and still can't get in.", time: "10:21 AM" }] },
  { id: 3, name: "Lana Steiner", email: "lana@company.com", initials: "LS", subject: "Question about team billing", preview: "Can you clarify how seats are counted?", time: "1h", status: "Pending", tag: "Billing", messages: [{ from: "customer", text: "Can you clarify how seats are counted on the Pro plan? We have a few contractors.", time: "9:30 AM" }] },
  { id: 4, name: "Demi Wilkinson", email: "demi@studio.design", initials: "DW", subject: "Feature request: dark mode", preview: "Would love to see a dark mode option.", time: "3h", status: "Open", tag: "Feedback", messages: [{ from: "customer", text: "Would love to see a dark mode option in the dashboard. The product is great otherwise!", time: "8:15 AM" }] },
  { id: 5, name: "Candice Wu", email: "candice@agency.co", initials: "CW", subject: "Refund request for subscription", preview: "I was charged twice this month.", time: "Yesterday", status: "Open", tag: "Billing", messages: [{ from: "customer", text: "I was charged twice this month and would like a refund. Can someone please take a look?", time: "Yesterday" }] },
  { id: 6, name: "Natali Craig", email: "natali@figma.com", initials: "NC", subject: "Thanks for the quick help!", preview: "That solved it perfectly. Appreciate your help!", time: "Yesterday", status: "Resolved", tag: "Product", messages: [{ from: "customer", text: "That solved it perfectly. Appreciate your help!", time: "Yesterday" }] }
];


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
  const [tickets, setTickets] = useState(initialTickets);
  const [selected, setSelected] = useState(1);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [section, setSection] = useState("Inbox");
  const [notice, setNotice] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);
  const [aiError, setAiError] = useState("");
  const active = tickets.find(t => t.id === selected) ?? tickets[0];
  const filtered = useMemo(() => tickets.filter(t => (filter === "All" || t.status === filter) && (!query || [t.name, t.subject, t.preview].some(v => v.toLowerCase().includes(query.toLowerCase())))), [tickets, filter, query]);
  function flash(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 2200); }
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
  function sendReply() {
    if (!draft.trim()) return;
    setTickets(old => old.map(t => t.id === selected ? { ...t, status: "Pending", preview: draft, messages: [...t.messages, { from: "agent", text: draft.trim(), time: "Now" }] } : t));
    setDraft(""); flash("Reply added to this demo conversation");
  }
  const nav = [{ label: "Workspace", items: [{ name: "Overview", icon: LayoutDashboard }, { name: "Inbox", icon: Inbox }, { name: "Contacts", icon: Users }, { name: "Knowledge base", icon: BookOpen }] }, { label: "Manage", items: [{ name: "Analytics", icon: Activity }, { name: "Team", icon: Users }] }];
  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark"><LifeBuoy size={19}/></span><b>resolve<span>ai</span></b></div><button className="workspace-switch"><span className="workspace-avatar">S</span><span><b>Studio workspace</b><small>Free plan</small></span><ChevronDown size={15}/></button>
      {nav.map(group => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(item => <button key={item.name} className={section === item.name ? "nav-item active" : "nav-item"} onClick={() => setSection(item.name)}><item.icon size={17}/>{item.name}</button>)}</div>)}
      <div className="nav-group"><div className="nav-label">Preferences</div><button className={section === "Settings" ? "nav-item active" : "nav-item"} onClick={() => setSection("Settings")}><Settings size={17}/>Settings</button></div>
      <div className="sidebar-bottom"><div className="usage-card"><b><Sparkles size={13}/> AI usage · 68%</b><div className="usage-track"><i/></div><small>680 of 1,000 credits used</small></div><div className="user-row"><div className="avatar">JD</div><span><b>Jordan Davis</b><small>Admin</small></span><MoreHorizontal size={17}/></div></div>
    </aside>
    <section className="main-area"><header className="topbar"><div className="breadcrumbs">Workspace <ChevronRight size={14}/><b>{section}</b></div><div className="top-actions"><label className="search-global"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search conversations..."/></label><button className="icon-btn" onClick={() => flash("You're all caught up")}><Bell size={18}/></button><button className="outline-btn" onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});window.location.href="/login/";}}>Sign out</button><div className="avatar">JD</div></div></header>
      {section === "Inbox" ? <div className="inbox-layout"><section className="inbox-list"><div className="page-heading"><div className="eyebrow">CUSTOMER SUPPORT</div><h1>Inbox <span className="count">12</span></h1><p>Manage and resolve customer conversations.</p></div><div className="tabs">{["All","Open","Pending","Resolved"].map(f => <button key={f} className={filter === f ? "tab active-tab" : "tab"} onClick={() => setFilter(f)}>{f}</button>)}</div><div className="conversation-list">{filtered.map(t => <button key={t.id} className={selected === t.id ? "conversation selected" : "conversation"} onClick={() => setSelected(t.id)}><div className="avatar">{t.initials}</div><div className="conversation-main"><div className="conversation-top"><b>{t.name}</b><time>{t.time}</time></div><strong>{t.subject}</strong><p>{t.preview}</p><small className="tag">{t.tag}</small></div></button>)}{filtered.length === 0 && <p className="empty-state">No conversations found.</p>}</div></section>
      <section className="conversation-detail"><div className="detail-header"><div className="avatar">{active.initials}</div><div className="detail-person"><b>{active.subject}</b><small>{active.name} · {active.email}</small></div><button className="outline-btn" onClick={() => { setTickets(old => old.map(t => t.id === selected ? { ...t, status: t.status === "Resolved" ? "Open" : "Resolved" } : t)); flash("Conversation status updated"); }}>{active.status === "Resolved" ? "Reopen" : "Resolve"}</button></div><div className="detail-subbar"><span className={"status-pill " + active.status.toLowerCase()}>{active.status}</span><span>· {active.tag}</span><span>· Assigned to you</span></div><div className="thread"><div className="thread-date">Today · Conversation</div>{active.messages.map((m,i) => <div className={"message-row " + (m.from === "agent" ? "from-agent" : "")} key={i}><div className="message-content"><div className="message-meta"><b>{m.from === "agent" ? "Jordan Davis" : active.name}</b><time>{m.time}</time></div><div className="message-bubble">{m.text}</div></div></div>)}<div className="reply-box"><div className="reply-mode"><MessageCircle size={14}/> Reply <span>Visible to customer</span></div><textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a reply..."/><div className="reply-tools"><small>{aiInsight ? "AI-assisted draft · Review before sending" : "AI Copilot · Draft mode"}</small><button className="primary-btn" onClick={sendReply}>Send reply <Send size={14}/></button></div></div></div></section>
      <aside className="copilot-panel"><div className="copilot-heading"><span className="copilot-icon"><Sparkles size={17}/></span><div><b>AI Copilot</b><small>Here to help you resolve faster</small></div></div><div className="demo-banner live-ai-banner">Free offline demo · Rule-based suggestions only (not a language model). Review every draft before sending.</div><button className="primary-btn ai-analyze-btn" onClick={analyzeConversation} disabled={aiLoading}>{aiLoading ? "Analyzing..." : "Analyze conversation"} <Sparkles size={14}/></button>{aiError && <div className="ai-error" role="alert">{aiError}</div>}{aiInsight ? <><div className="insight-card"><b>Customer sentiment</b><span>{aiInsight.sentiment}</span></div><div className="insight-card"><b>Urgency</b><span>{aiInsight.urgency}</span></div><div className="insight-card"><b>Detected intent</b><span>{aiInsight.intent}</span></div><div className="copilot-tip"><b>Next step</b><br/>{aiInsight.next_step}</div><div className="ai-draft"><b>Suggested reply</b><p>{aiInsight.suggested_reply}</p>{aiInsight.disclaimer && <small>{aiInsight.disclaimer}</small>}<button className="outline-btn" onClick={() => setDraft(aiInsight.suggested_reply)}>Use this draft</button></div></> : <div className="copilot-tip">Select “Analyze conversation” for a free, rule-based demo analysis. It does not use a paid AI API.</div>}</aside></div> : section === "Team" ? <TeamPanel /> : <div className="content-page"><div className="eyebrow">RESOLVEAI WORKSPACE</div><h1>{section}</h1><p>This section is part of the ResolveAI starter dashboard.</p><div className="placeholder-card"><Sparkles size={22}/><b>{section}</b><span>Choose Inbox to return to customer conversations.</span><button className="primary-btn" onClick={() => setSection("Inbox")}>Open inbox</button></div></div>}
      {notice && <div className="toast"><Check size={16}/>{notice}</div>}
    </section>
  </main>;
}
