"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Building2, CheckCircle2, ClipboardCheck, LifeBuoy, LockKeyhole, ShieldCheck, Users } from "lucide-react";

type Item={user_id:string;email:string;full_name:string;phone:string;identity_number:string;unit_code:string;unit_details:string;resident_type:string;payment_method:string;payment_reference:string;status:string};
type LegacyUser={user_id:string;email:string;role:string;workspace_name:string};

export default function MembershipAdminPage(){
  const router=useRouter();
  const [items,setItems]=useState<Item[]>([]);
  const [legacyUsers,setLegacyUsers]=useState<LegacyUser[]>([]);
  const [unitCodes,setUnitCodes]=useState<Record<string,string>>({});
  const [error,setError]=useState("");
  const [busy,setBusy]=useState("");
  const [loading,setLoading]=useState(true);

  async function load(){
    setError("");
    const [requestsResponse,legacyResponse]=await Promise.all([
      fetch("/api/membership",{cache:"no-store"}),
      fetch("/api/admin/legacy-members",{cache:"no-store"})
    ]);
    const requests=await requestsResponse.json();
    const legacy=await legacyResponse.json();
    if(requestsResponse.status===401||legacyResponse.status===401){router.replace("/login/");return;}
    if(!requestsResponse.ok)throw new Error(requests.error||"Could not load membership requests.");
    if(!legacyResponse.ok)throw new Error(legacy.error||"Could not load existing accounts.");
    setItems(requests.requests||[]);
    setLegacyUsers(legacy.users||[]);
  }

  useEffect(()=>{load().catch(e=>setError(e instanceof Error?e.message:"Could not load administration data.")).finally(()=>setLoading(false));},[]);

  async function review(id:string,status:"approved"|"rejected"){
    setBusy(id);setError("");
    try{
      const r=await fetch("/api/membership/"+encodeURIComponent(id),{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Review failed.");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Review failed.");}
    finally{setBusy("");}
  }

  async function mapLegacy(user:LegacyUser){
    const unit_code=(unitCodes[user.user_id]||"").trim();
    if(!unit_code){setError("Enter and verify the unit code before assigning this account.");return;}
    setBusy(user.user_id);setError("");
    try{
      const r=await fetch("/api/admin/legacy-members/"+encodeURIComponent(user.user_id),{
        method:"PATCH",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({unit_code})
      });
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not assign this account.");
      setUnitCodes(old=>({...old,[user.user_id]:""}));
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Could not assign this account.");}
    finally{setBusy("");}
  }

  return <main className="auth-shell rx-auth-shell rx-admin-shell">
    <div className="rx-auth-glow rx-auth-glow-one" aria-hidden="true" />
    <div className="rx-admin-layout">
      <aside className="rx-admin-story">
        <a href="/website/" className="rx-auth-brand"><span className="rx-auth-brand-mark"><LifeBuoy size={20}/></span><span>Resolve<span>AI</span></span></a>
        <div className="rx-auth-kicker"><span/> ADMINISTRATION</div>
        <h2>Manage access with <em>care and clarity.</em></h2>
        <p>Review membership applications and map existing accounts only after verifying each resident's actual unit details.</p>
        <div className="rx-admin-story-stat"><span><ClipboardCheck size={17}/></span><div><b>Human-reviewed access</b><small>Approvals are explicit and auditable.</small></div></div>
        <div className="rx-admin-story-stat"><span><Building2 size={17}/></span><div><b>Unit-level workspaces</b><small>Access is assigned to a verified unit.</small></div></div>
        <div className="rx-admin-story-foot"><LockKeyhole size={14}/> Administrator-only area</div>
      </aside>
      <section className="auth-card rx-admin-card">
    <div className="auth-card-brand"><span className="auth-card-mark"><LifeBuoy size={18}/></span><span>Resolve<span>AI</span></span></div>
    <div className="rx-auth-form-kicker"><span/> BLOCK ADMINISTRATION</div>
    <h1>Membership and unit access</h1>
    <p className="auth-description">Review new applications and carefully map existing accounts to their verified unit. Mapping does not change passwords or delete account records.</p>
    {error&&<div className="auth-error" role="alert">{error}</div>}
    <div className="rx-admin-section-head">
      <div><h2>New membership requests</h2><span>{items.length} currently available for review</span></div>
      <button className="outline-btn rx-refresh-btn" onClick={()=>load().catch(e=>setError(e instanceof Error?e.message:"Refresh failed."))}>Refresh</button>
    </div>
    {loading?<p>Loading…</p>:items.length===0?<p>No pending membership requests.</p>:items.map(x=><article key={x.user_id} className="rx-admin-record rx-membership-record">
      <b>{x.full_name||"Name not provided"}</b><p>{x.email} · {x.phone}</p>
      <p>Identity: {x.identity_number} · Unit code: {x.unit_code}</p>
      <p>Unit: {x.unit_details} · Relationship: {x.resident_type}</p>
      <p>Payment: {x.payment_method} · Reference: {x.payment_reference}</p><small>Status: {x.status}</small>
      <div className="rx-admin-actions">
        <button className="auth-submit rx-approve-btn" disabled={!!busy} onClick={()=>review(x.user_id,"approved")}>{busy===x.user_id?"Please wait…":"Approve membership"}</button>
        <button className="outline-btn rx-reject-btn" disabled={!!busy} onClick={()=>review(x.user_id,"rejected")}>Reject</button>
      </div>
    </article>)}

    <div className="rx-legacy-section">
      <div className="rx-admin-section-head"><div><h2>Existing accounts not yet assigned</h2><span>{legacyUsers.length} accounts awaiting a verified unit mapping</span></div><span className="rx-admin-section-icon"><Users size={17}/></span></div>
      <p className="auth-description">Assign one account at a time after checking the person’s actual unit code against your trusted resident records. No automatic grouping is performed. This changes account access only; historical conversations are not automatically moved and remain in the main workspace until reviewed separately.</p>
      {legacyUsers.length===0?<p>There are no unmapped existing accounts in the main workspace.</p>:legacyUsers.map(user=><article key={user.user_id} className="rx-admin-record rx-legacy-record">
        <div className="rx-legacy-row">
          <div><b>{user.email}</b><p style={{margin:"4px 0",fontSize:13,color:"#64748b"}}>Current role: {user.role} · {user.workspace_name}</p></div>
          <label className="rx-unit-field">Verified unit code
            <input value={unitCodes[user.user_id]||""} onChange={e=>setUnitCodes(old=>({...old,[user.user_id]:e.target.value.toUpperCase()}))} placeholder="e.g. A101" maxLength={32} className="rx-unit-code-input"/>
          </label>
          <button className="auth-submit rx-approve-btn" disabled={!!busy||!(unitCodes[user.user_id]||"").trim()} onClick={()=>mapLegacy(user)}>{busy===user.user_id?"Assigning…":"Assign to unit"}</button>
        </div>
      </article>)}
    </div>
    <p className="auth-footnote" style={{marginTop:22}}>Important: existing accounts are not moved until you explicitly assign a verified unit code. Block administrator access is available across mapped unit workspaces.</p>
    <div className="auth-footnote"><button onClick={()=>router.replace("/")}>Back to workspace</button></div>
    <a href="/website/" className="rx-auth-backlink">ResolveAI home <ArrowUpRight size={13}/></a>
      </section>
    </div>
  </main>;
}
