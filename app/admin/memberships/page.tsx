"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

  return <main className="auth-shell"><section className="auth-card" style={{maxWidth:960,width:"100%"}}>
    <div className="auth-brand"><span className="auth-mark">✦</span><span>resolve<strong>ai</strong></span></div>
    <div className="auth-eyebrow">BLOCK ADMINISTRATION</div>
    <h1>Membership and unit access</h1>
    <p className="auth-description">Review new applications and carefully map existing accounts to their verified unit. Mapping does not change passwords or delete account records.</p>
    {error&&<div className="auth-error" role="alert">{error}</div>}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginTop:18}}>
      <h2 style={{fontSize:18,margin:0}}>New membership requests ({items.length})</h2>
      <button className="outline-btn" onClick={()=>load().catch(e=>setError(e instanceof Error?e.message:"Refresh failed."))}>Refresh</button>
    </div>
    {loading?<p>Loading…</p>:items.length===0?<p>No pending membership requests.</p>:items.map(x=><article key={x.user_id} style={{border:"1px solid #e5e7eb",borderRadius:12,padding:16,marginTop:14,textAlign:"left"}}>
      <b>{x.full_name||"Name not provided"}</b><p>{x.email} · {x.phone}</p>
      <p>Identity: {x.identity_number} · Unit code: {x.unit_code}</p>
      <p>Unit: {x.unit_details} · Relationship: {x.resident_type}</p>
      <p>Payment: {x.payment_method} · Reference: {x.payment_reference}</p><small>Status: {x.status}</small>
      <div style={{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}}>
        <button className="auth-submit" disabled={!!busy} onClick={()=>review(x.user_id,"approved")}>{busy===x.user_id?"Please wait…":"Approve membership"}</button>
        <button className="outline-btn" disabled={!!busy} onClick={()=>review(x.user_id,"rejected")}>Reject</button>
      </div>
    </article>)}

    <div style={{borderTop:"1px solid #e5e7eb",marginTop:28,paddingTop:22}}>
      <h2 style={{fontSize:18,margin:"0 0 8px"}}>Existing accounts not yet assigned ({legacyUsers.length})</h2>
      <p className="auth-description">Assign one account at a time after checking the person’s actual unit code against your trusted resident records. No automatic grouping is performed.</p>
      {legacyUsers.length===0?<p>There are no unmapped existing accounts in the main workspace.</p>:legacyUsers.map(user=><article key={user.user_id} style={{border:"1px solid #e5e7eb",borderRadius:12,padding:14,marginTop:12,textAlign:"left"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div><b>{user.email}</b><p style={{margin:"4px 0",fontSize:13,color:"#64748b"}}>Current role: {user.role} · {user.workspace_name}</p></div>
          <label style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>Verified unit code
            <input value={unitCodes[user.user_id]||""} onChange={e=>setUnitCodes(old=>({...old,[user.user_id]:e.target.value.toUpperCase()}))} placeholder="e.g. A101" maxLength={32} style={{width:130}}/>
          </label>
          <button className="auth-submit" disabled={!!busy||!(unitCodes[user.user_id]||"").trim()} onClick={()=>mapLegacy(user)}>{busy===user.user_id?"Assigning…":"Assign to unit"}</button>
        </div>
      </article>)}
    </div>
    <p className="auth-footnote" style={{marginTop:22}}>Important: existing accounts are not moved until you explicitly assign a verified unit code. Block administrator access is available across mapped unit workspaces.</p>
    <div className="auth-footnote"><button onClick={()=>router.replace("/")}>Back to workspace</button></div>
  </section></main>;
}
