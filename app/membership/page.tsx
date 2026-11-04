"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Building2, CheckCircle2, CreditCard, Home, LifeBuoy, LockKeyhole, ShieldCheck } from "lucide-react";

type RequestData = {
  full_name?: string; phone?: string; identity_number?: string; unit_code?: string;
  unit_details?: string; resident_type?: string; payment_method?: string;
  payment_reference?: string; status?: string; review_note?: string;
};

const PREVIEW_HOST = "feature-unit-membership-approval-resolveai.aflakshhr.workers.dev";

const PREVIEW_TEST_DATA: RequestData = {
  full_name: "QA Test Resident",
  phone: "0000000000",
  identity_number: "TEST-ID-001",
  unit_code: "QA-UNIT-01",
  unit_details: "Test Building, Floor 1, Unit 01",
  resident_type: "owner",
  payment_method: "other",
  payment_reference: "TEST-REF-001",
};

export default function MembershipPage() {
  const router = useRouter();
  const [form, setForm] = useState<RequestData>({resident_type:"owner",payment_method:"bank_transfer"});
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    // Keep test helpers strictly off the production hostname.
    setIsPreview(window.location.hostname === PREVIEW_HOST);
    fetch("/api/membership",{cache:"no-store"}).then(async r => {
      const d=await r.json();
      if(r.status===401){router.replace("/login/");return;}
      if(!r.ok)throw new Error(d.error||"Unable to load membership form.");
      if(d.request)setForm(v=>({...v,...d.request}));
      setStatus(d.request?.status||"not_submitted");
    }).catch(e=>setError(e instanceof Error?e.message:"Unable to load form."));
  },[router]);

  function change(key:keyof RequestData,value:string){setForm(v=>({...v,[key]:value}));}

  function fillPreviewTestData() {
    if (!isPreview) return;
    setForm(v=>({...v,...PREVIEW_TEST_DATA}));
    setError("");
  }

  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");
    try{
      const r=await fetch("/api/membership",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(form)});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not submit request.");
      setStatus("pending");
    }catch(e){setError(e instanceof Error?e.message:"Could not submit request.");}finally{setBusy(false);}
  }

  const field=(label:string,key:keyof RequestData,placeholder:string,required=true)=><label className="membership-field">{label}<input value={String(form[key]||"")} onChange={e=>change(key,e.target.value)} placeholder={placeholder} required={required} maxLength={key==="unit_details"?500:160}/></label>;

  return <main className="auth-shell rx-auth-shell rx-membership-shell">
    <div className="rx-auth-glow rx-auth-glow-one" aria-hidden="true" />
    <div className="rx-auth-layout rx-auth-layout-wide">
      <aside className="rx-auth-story rx-membership-story">
        <a href="/website/" className="rx-auth-brand">
          <span className="rx-auth-brand-mark"><LifeBuoy size={20}/></span>
          <span>Resolve<span>AI</span></span>
        </a>
        <div className="rx-auth-story-copy">
          <div className="rx-auth-kicker"><span/> MEMBERSHIP REVIEW</div>
          <h2>Connect your account to <em>your unit.</em></h2>
          <p>Complete the details below so the block administrator can review your request and activate the appropriate private workspace access.</p>
          <div className="rx-auth-points">
            <div><span><Building2 size={16}/></span><div><b>Unit verification</b><small>Your unit code and building details are reviewed.</small></div></div>
            <div><span><CreditCard size={16}/></span><div><b>Payment reference</b><small>Provide a receipt or tracking reference only.</small></div></div>
            <div><span><ShieldCheck size={16}/></span><div><b>Administrator approval</b><small>Private access follows a human review.</small></div></div>
          </div>
        </div>
        <div className="rx-auth-story-foot"><LockKeyhole size={14}/> Your details are limited to authorized administrators</div>
      </aside>
      <section className="auth-card rx-auth-card rx-membership-card">
    <div className="auth-card-brand"><span className="auth-card-mark"><LifeBuoy size={18}/></span><span>Resolve<span>AI</span></span></div>
    <div className="rx-auth-form-kicker"><span/> UNIT MEMBERSHIP</div><h1>Complete your membership details</h1>
    <p className="auth-description">Your account is active with limited access. Submit your identity and unit information for review by the block administrator. Full private access is enabled only after approval.</p>
    {status==="approved"?<div className="auth-footnote">Your membership is approved. <button onClick={()=>router.replace("/")}>Continue to workspace</button></div>:status==="pending"?<div className="auth-error" style={{background:"#eff6ff",color:"#1d4ed8"}}>Your request has been submitted and is waiting for administrator review. You can update and resubmit the form below if needed.</div>:null}
    {error&&<div className="auth-error">{error}</div>}
    <form className="auth-form" onSubmit={submit}>
      {isPreview&&status!=="approved"?<>
        <button type="button" className="outline-btn" onClick={fillPreviewTestData} disabled={busy}>Fill test data (Preview only)</button>
        <p className="auth-footnote">This fills fictitious QA values only. It does not submit the form. Do not use these values as real resident information.</p>
      </>:null}
      {field("Full legal name","full_name","Name as shown on identity document")}
      {field("Phone number","phone","+country code and number")}
      {field("Identity number","identity_number","Identity document number")}
      {field("Unit's assigned code","unit_code","Your unique unit code")}
      {field("Unit details / building address","unit_details","Building, floor, unit number")}
      <label>Relationship to unit<select value={form.resident_type||"owner"} onChange={e=>change("resident_type",e.target.value)}><option value="owner">Owner</option><option value="tenant">Tenant</option><option value="family">Family member / resident</option></select></label>
      <label>Payment method<select value={form.payment_method||"bank_transfer"} onChange={e=>change("payment_method",e.target.value)}><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="other">Other</option></select></label>
      {field("Payment / dues reference (receipt or tracking number)","payment_reference","Reference number — do not enter card details")}
      <p className="auth-footnote">Only provide the payment reference. Never enter a bank-card number, PIN, password or one-time verification code. Your identity and unit details are visible only to authorized block administrators.</p>
      <button className="auth-submit" type="submit" disabled={busy||status==="approved"}>{busy?"Submitting…":status==="pending"?"Update and resubmit request":"Submit for administrator approval"}</button>
    </form>
    <div className="auth-footnote"><button onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});router.replace("/login/");}}>Sign out</button></div>
    <a href="/website/" className="rx-auth-backlink">Back to ResolveAI <ArrowUpRight size={13}/></a>
      </section>
    </div>
  </main>;
}
