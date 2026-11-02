const requestWindows = new Map();
const COOKIE = "resolveai_session";
const SESSION_SECONDS = 604800;
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
const cookie = (value, age = SESSION_SECONDS) => `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;
function getCookie(request) {
  const part = (request.headers.get("Cookie") || "").split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE + "="));
  return part ? part.slice(COOKIE.length + 1) : null;
}
function randomToken() { const b = crypto.getRandomValues(new Uint8Array(32)); let s = ""; for (const n of b) s += String.fromCharCode(n); return btoa(s).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_"); }
async function digest(value) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); let s=""; for(const n of new Uint8Array(b)) s+=String.fromCharCode(n); return btoa(s).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_"); }
function equal(a,b) { if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false; let n=0; for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i); return n===0; }
function decode64url(s) { const b=atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)); return Uint8Array.from(b,c=>c.charCodeAt(0)); }
async function passwordHash(password, saltText) {
  const salt = saltText ? decode64url(saltText) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:310000},key,256);
  let s=""; for(const n of new Uint8Array(bits))s+=String.fromCharCode(n);
  return {hash:btoa(s).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_"),salt:(()=>{let v="";for(const n of salt)v+=String.fromCharCode(n);return btoa(v).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")})()};
}
const validEmail = v => typeof v==="string" && v.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const validPassword = v => typeof v==="string" && v.length>=12 && v.length<=128;
const allowedOrigin = r => !r.headers.get("Origin") || r.headers.get("Origin")===new URL(r.url).origin;
async function body(r){try{return await r.json()}catch{return null}}
async function sessionFor(request,env) {
  if(!env.DB)return null;
  const token=getCookie(request); if(!token||token.length>200)return null;
  return await env.DB.prepare(`SELECT u.id AS user_id,u.email,w.id AS workspace_id,w.name AS workspace_name,wm.role
    FROM sessions s JOIN users u ON u.id=s.user_id JOIN workspace_members wm ON wm.user_id=u.id
    JOIN workspaces w ON w.id=wm.workspace_id WHERE s.token_hash=? AND s.expires_at>? ORDER BY wm.created_at LIMIT 1`)
    .bind(await digest(token),new Date().toISOString()).first();
}
async function newSession(env,userId) {
  const token=randomToken();
  await env.DB.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)")
    .bind(crypto.randomUUID(),userId,await digest(token),new Date(Date.now()+SESSION_SECONDS*1000).toISOString()).run();
  return token;
}
async function auth(request,env,path) {
  if(path==="/api/auth/status"&&request.method==="GET"){
    if(!env.DB)return json({error:"Database binding DB is not configured."},503);
    const n=await env.DB.prepare("SELECT COUNT(*) AS total FROM users").first();
    return json({setup_required:Number(n?.total||0)===0,setup_enabled:Boolean(env.RESOLVEAI_SETUP_TOKEN)});
  }
  if(path==="/api/auth/logout"&&request.method==="POST"){
    if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
    const token=getCookie(request); if(env.DB&&token)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(token)).run();
    return json({ok:true},200,{"set-cookie":cookie("",0)});
  }
  if(!env.DB)return json({error:"Database binding DB is not configured."},503);
  if(path==="/api/auth/setup"&&request.method==="POST"){
    if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
    if(!env.RESOLVEAI_SETUP_TOKEN)return json({error:"Set the RESOLVEAI_SETUP_TOKEN secret before initial setup."},503);
    const b=await body(request);
    if(!b||!equal(String(b.setup_token||""),env.RESOLVEAI_SETUP_TOKEN))return json({error:"Invalid setup token."},403);
    if(!validEmail(b.email)||!validPassword(b.password))return json({error:"Enter a valid email and a password with at least 12 characters."},400);
    const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM users").first();
    if(Number(count?.total||0)!==0)return json({error:"Initial setup has already been completed."},409);
    const id=crypto.randomUUID(),wid=crypto.randomUUID(),pw=await passwordHash(b.password);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id,email,password_hash,password_salt,email_verified_at) VALUES (?,?,?,?,?)").bind(id,b.email.trim().toLowerCase(),pw.hash,pw.salt,new Date().toISOString()),
      env.DB.prepare("INSERT INTO workspaces (id,name,owner_user_id) VALUES (?,?,?)").bind(wid,(b.workspace_name||"My team").toString().slice(0,80),id),
      env.DB.prepare("INSERT INTO workspace_members (workspace_id,user_id,role) VALUES (?,?,'owner')").bind(wid,id)
    ]);
    return json({ok:true},201,{"set-cookie":cookie(await newSession(env,id))});
  }
  if(path==="/api/auth/login"&&request.method==="POST"){
    if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
    const b=await body(request);
    if(!b||!validEmail(b.email)||typeof b.password!=="string")return json({error:"Enter your email and password."},400);
    const ip=request.headers.get("CF-Connecting-IP")||"unknown",key="login:"+ip+":"+b.email.trim().toLowerCase(),now=Date.now();\n    const attempts=(requestWindows.get(key)||[]).filter(t=>now-t<60000);\n    if(attempts.length>=10)return json({error:"Too many sign-in attempts. Wait a minute and try again."},429);\n    attempts.push(now);requestWindows.set(key,attempts);\n    const u=await env.DB.prepare("SELECT id,password_hash,password_salt FROM users WHERE email=? COLLATE NOCASE").bind(b.email.trim()).first();
    if(!u)return json({error:"Email or password is incorrect."},401);
    const pw=await passwordHash(b.password,u.password_salt);
    if(!equal(pw.hash,u.password_hash))return json({error:"Email or password is incorrect."},401);
    return json({ok:true},200,{"set-cookie":cookie(await newSession(env,u.id))});
  }
  if(path==="/api/auth/accept-invite"&&request.method==="POST"){
    if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
    const b=await body(request);
    if(!b||typeof b.invite_token!=="string"||!validEmail(b.email)||!validPassword(b.password))return json({error:"Invitation, valid email and password (12+ characters) are required."},400);
    const inv=await env.DB.prepare("SELECT id,workspace_id,email,role FROM team_invites WHERE token_hash=? AND accepted_at IS NULL AND expires_at>?").bind(await digest(b.invite_token),new Date().toISOString()).first();
    if(!inv||String(inv.email).toLowerCase()!==b.email.trim().toLowerCase())return json({error:"Invitation is invalid, expired, or for another email."},400);
    const exists=await env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE").bind(b.email.trim()).first();
    if(exists)return json({error:"This email already has an account. Please sign in."},409);
    const id=crypto.randomUUID(),pw=await passwordHash(b.password);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id,email,password_hash,password_salt,email_verified_at) VALUES (?,?,?,?,?)").bind(id,b.email.trim().toLowerCase(),pw.hash,pw.salt,new Date().toISOString()),
      env.DB.prepare("INSERT INTO workspace_members (workspace_id,user_id,role) VALUES (?,?,?)").bind(inv.workspace_id,id,inv.role),
      env.DB.prepare("UPDATE team_invites SET accepted_at=? WHERE id=? AND accepted_at IS NULL").bind(new Date().toISOString(),inv.id)
    ]);
    return json({ok:true},201,{"set-cookie":cookie(await newSession(env,id))});
  }
  return null;
}
function analyzeOffline(subject,messages) {
  const text=(subject+" "+messages.filter(m=>m.from==="Customer").map(m=>m.text).join(" ")).toLowerCase();
  const has=words=>words.some(w=>text.includes(w));
  const urgent=has(["urgent","asap","immediately","emergency","can't access","cannot access","locked out","fraud","unauthorized","lost","broken","not working","angry","cancel my account"]);
  const shipping=has(["order","tracking","shipment","shipping","delivery","package","parcel"]);
  const account=has(["login","log in","sign in","password","account","access"]);
  const billing=has(["billing","bill","charged","charge","refund","payment","invoice","subscription","price"]);
  const feedback=has(["feature","suggestion","feedback","dark mode","would love"]);
  const positive=has(["thank you","thanks","great","appreciate","love it","solved","excellent"]);
  const negative=has(["frustrated","angry","upset","disappointed","unacceptable","problem","issue","haven't","not received","can't","cannot"]);
  let intent="General support",next_step="Review the conversation and ask for missing details before taking action.",suggested_reply="Thanks for reaching out. I’m happy to help. Could you share a little more detail so I can look into this for you?";
  if(shipping){intent="Order and shipping";next_step="Check the order and carrier tracking; confirm the latest verified status.";suggested_reply="Thanks for reaching out. I’m sorry you haven’t received an update. I’ll review the order and tracking details and share an update once confirmed."}
  else if(account){intent="Account access";next_step="Verify the account through the approved support process.";suggested_reply="I’m sorry you’re having trouble accessing your account. Please don’t share your password or verification codes. Our team can check the sign-in issue through the approved process."}
  else if(billing){intent="Billing and payments";next_step="Review the invoice and payment records before confirming an adjustment.";suggested_reply="Thanks for flagging this. I’ll review the relevant invoice and payment records before confirming what happened."}
  else if(feedback){intent="Product feedback";next_step="Record the suggestion with the product team.";suggested_reply="Thanks for sharing this suggestion. I’ll pass the feedback to the product team for review."}
  else if(positive){intent="Positive feedback";next_step="Acknowledge the feedback and close the conversation if no further help is needed.";suggested_reply="You’re very welcome! I’m glad we could help. Please reach out anytime."}
  if(urgent)next_step="Prioritize this conversation and escalate through the team's approved process if needed.";
  return {sentiment:positive&&!negative?"Positive":negative?"Frustrated / concerned":"Neutral",urgency:urgent?"High":shipping||billing||account?"Medium":"Low",intent,suggested_reply,next_step,mode:"offline-demo",disclaimer:"Rule-based suggestion, not generated by a language model. Verify all details before use."};
}
async function analyze(request) {
  if(request.method!=="POST")return json({error:"Method not allowed."},405);
  if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
  const ip=request.headers.get("CF-Connecting-IP")||"unknown",now=Date.now();
  const recent=(requestWindows.get(ip)||[]).filter(t=>now-t<60000);
  if(recent.length>=8)return json({error:"Too many requests. Please wait a minute and try again."},429);
  recent.push(now);requestWindows.set(ip,recent);
  const b=await body(request),subject=typeof b?.subject==="string"?b.subject.slice(0,240):"";
  if(!Array.isArray(b?.messages)||b.messages.length<1||b.messages.length>12)return json({error:"Provide between 1 and 12 messages."},400);
  const messages=b.messages.map(m=>({from:m&&(m.from==="agent"||m.from==="Agent")?"Agent":"Customer",text:m&&typeof m.text==="string"?m.text.slice(0,2000):""})).filter(m=>m.text.trim());
  if(!messages.length)return json({error:"The conversation has no readable messages."},400);
  return json(analyzeOffline(subject,messages));
}
function publicAsset(path) { return path.startsWith("/_next/")||["/icon.svg","/manifest.webmanifest","/sw.js","/favicon.ico"].includes(path)||/\.(png|jpg|jpeg|svg|webp|ico|css|js|woff2?)$/i.test(path); }
export default {
  async fetch(request,env) {
    const url=new URL(request.url),path=url.pathname.replace(/\/$/,"")||"/";
    if(path==="/api/health"&&request.method==="GET")return json({service:"ResolveAI",status:"ok",mode:"private-team",database_configured:Boolean(env.DB)});
    if(path.startsWith("/api/auth/")){const result=await auth(request,env,path);if(result)return result;}
    if(path.startsWith("/api/")){
      if(!env.DB)return json({error:"Database binding DB is not configured."},503);
      const session=await sessionFor(request,env);
      if(!session)return json({error:"Authentication required."},401);
      if(path==="/api/auth/me"&&request.method==="GET")return json({user:{id:session.user_id,email:session.email},workspace:{id:session.workspace_id,name:session.workspace_name},role:session.role});
      if(path==="/api/auth/invites"&&request.method==="POST"){
        if(!["owner","admin"].includes(session.role))return json({error:"Only workspace admins can invite members."},403);
        const b=await body(request),email=b?.email,role=b?.role;
        if(!validEmail(email)||!["admin","agent","viewer"].includes(role))return json({error:"Provide a valid email and role."},400);
        const token=randomToken(),expires=new Date(Date.now()+7*86400000).toISOString();
        await env.DB.prepare("INSERT INTO team_invites (id,workspace_id,email,role,token_hash,expires_at,created_by_user_id) VALUES (?,?,?,?,?,?,?)")
          .bind(crypto.randomUUID(),session.workspace_id,email.trim().toLowerCase(),role,await digest(token),expires,session.user_id).run();
        return json({ok:true,invite_url:new URL("/login/?invite="+encodeURIComponent(token),request.url).toString(),expires_at:expires},201);
      }
      if(path==="/api/ai")return analyze(request);
      return json({error:"Not found."},404);
    }
    const session=await sessionFor(request,env);
    if(path==="/login")return session?Response.redirect(new URL("/",request.url),302):env.ASSETS.fetch(request);
    if(!publicAsset(path)&&!session)return Response.redirect(new URL("/login/",request.url),302);
    return env.ASSETS.fetch(request);
  }
};
