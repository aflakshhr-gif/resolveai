import { analyzeOffline } from "./lib/ai-offline.mjs";
import { createPasswordHash, verifyPassword, isCurrentPasswordHash } from "./lib/passwords.mjs";
const requestWindows = new Map();
const COOKIE = "resolveai_session";
const SESSION_SECONDS = 604800;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, email_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner','admin','agent','viewer')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL, customer_email TEXT, subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','pending','resolved')),
  tag TEXT NOT NULL DEFAULT 'General', assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK(author_type IN ('customer','agent','system')),
  author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 20000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS team_invites (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE, role TEXT NOT NULL CHECK(role IN ('admin','agent','viewer')),
  token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, accepted_at TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry ON sessions(user_id,expires_at);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace_updated ON conversations(workspace_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id,created_at);
CREATE INDEX IF NOT EXISTS idx_team_invites_workspace_email ON team_invites(workspace_id,email);
`;
let schemaPromise;
async function ensureSchema(env) {
  if (!env.DB) throw new Error("Database binding DB is not configured.");
  if (!schemaPromise) {
    schemaPromise = env.DB.exec(SCHEMA_SQL.replaceAll(/\n/g, " ")).catch(error => { schemaPromise = null; throw error; });
  }
  await schemaPromise;
}

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
const cookie = (value, age = SESSION_SECONDS) => `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;
function getCookie(request) {
  const part = (request.headers.get("Cookie") || "").split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE + "="));
  return part ? part.slice(COOKIE.length + 1) : null;
}
function randomToken() { const b = crypto.getRandomValues(new Uint8Array(32)); let s = ""; for (const n of b) s += String.fromCharCode(n); return btoa(s).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_"); }
async function digest(value) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); let s=""; for(const n of new Uint8Array(b)) s+=String.fromCharCode(n); return btoa(s).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_"); }
function equal(a,b) { if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false; let n=0; for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i); return n===0; }
const validEmail = v => typeof v==="string" && v.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const validPassword = v => typeof v==="string" && v.length>=12 && v.length<=128;
const allowedOrigin = r => !r.headers.get("Origin") || r.headers.get("Origin")===new URL(r.url).origin;
async function body(r){try{return await r.json()}catch{return null}}
async function sessionFor(request,env) {
  if(!env.DB)return null;
  await ensureSchema(env);
  const authorization=request.headers.get("Authorization")||"";
  const bearer=authorization.startsWith("Bearer ")?authorization.slice(7).trim():null;
  const token=bearer||getCookie(request); if(!token||token.length>200)return null;
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
    await ensureSchema(env);
    const n=await env.DB.prepare("SELECT COUNT(*) AS total FROM users").first();
    return json({setup_required:Number(n?.total||0)===0,setup_enabled:Boolean(env.RESOLVEAI_SETUP_TOKEN)});
  }
  if(path==="/api/auth/logout"&&request.method==="POST"){
    if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
    const authHeader=request.headers.get("Authorization")||"";
    const bearer=authHeader.startsWith("Bearer ")?authHeader.slice(7).trim():null;
    const token=getCookie(request)||bearer; if(env.DB&&token)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(token)).run();
    return json({ok:true},200,{"set-cookie":cookie("",0)});
  }
  if(!env.DB)return json({error:"Database binding DB is not configured."},503);
  await ensureSchema(env);
  if(path==="/api/auth/setup"&&request.method==="POST"){
    if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
    if(!env.RESOLVEAI_SETUP_TOKEN)return json({error:"Set the RESOLVEAI_SETUP_TOKEN secret before initial setup."},503);
    const b=await body(request);
    if(!b||!equal(String(b.setup_token||""),env.RESOLVEAI_SETUP_TOKEN))return json({error:"Invalid setup token."},403);
    if(!validEmail(b.email)||!validPassword(b.password))return json({error:"Enter a valid email and a password with at least 12 characters."},400);
    const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM users").first();
    if(Number(count?.total||0)!==0)return json({error:"Initial setup has already been completed."},409);
    const id=crypto.randomUUID(),wid=crypto.randomUUID(),pw=await createPasswordHash(b.password);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id,email,password_hash,password_salt) VALUES (?,?,?,?)").bind(id,b.email.trim().toLowerCase(),pw.hash,pw.salt),
      env.DB.prepare("INSERT INTO workspaces (id,name,owner_user_id) VALUES (?,?,?)").bind(wid,(b.workspace_name||"My team").toString().slice(0,80),id),
      env.DB.prepare("INSERT INTO workspace_members (workspace_id,user_id,role) VALUES (?,?,'owner')").bind(wid,id)
    ]);
    return json({ok:true},201,{"set-cookie":cookie(await newSession(env,id))});
  }
  if(path==="/api/auth/login"&&request.method==="POST"){
    if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
    const b=await body(request);
    if(!b||!validEmail(b.email)||typeof b.password!=="string")return json({error:"Enter your email and password."},400);
    const ip=request.headers.get("CF-Connecting-IP")||"unknown",key="login:"+ip+":"+b.email.trim().toLowerCase(),now=Date.now();
    const attempts=(requestWindows.get(key)||[]).filter(t=>now-t<60000);
    if(attempts.length>=10)return json({error:"Too many sign-in attempts. Wait a minute and try again."},429);
    attempts.push(now);requestWindows.set(key,attempts);
    const u=await env.DB.prepare("SELECT id,password_hash,password_salt FROM users WHERE email=? COLLATE NOCASE").bind(b.email.trim()).first();
    if(!u){
      // Do equivalent KDF work for unknown accounts to reduce response-time account enumeration.
      await createPasswordHash(b.password);
      return json({error:"Email or password is incorrect."},401);
    }
    if(!await verifyPassword(b.password,u.password_hash,u.password_salt))return json({error:"Email or password is incorrect."},401);
    if(!isCurrentPasswordHash(u.password_hash)){
      const upgraded=await createPasswordHash(b.password);
      await env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,updated_at=? WHERE id=?")
        .bind(upgraded.hash,upgraded.salt,new Date().toISOString(),u.id).run();
    }
    const sessionToken=await newSession(env,u.id);
    if(request.headers.get("X-ResolveAI-Client")==="mobile")return json({ok:true,access_token:sessionToken,expires_in:SESSION_SECONDS});
    return json({ok:true},200,{"set-cookie":cookie(sessionToken)});
  }
  if(path==="/api/auth/accept-invite"&&request.method==="POST"){
    if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
    const b=await body(request);
    if(!b||typeof b.invite_token!=="string"||!validEmail(b.email)||!validPassword(b.password))return json({error:"Invitation, valid email and password (12+ characters) are required."},400);
    const inv=await env.DB.prepare("SELECT id,workspace_id,email,role FROM team_invites WHERE token_hash=? AND accepted_at IS NULL AND expires_at>?").bind(await digest(b.invite_token),new Date().toISOString()).first();
    if(!inv||String(inv.email).toLowerCase()!==b.email.trim().toLowerCase())return json({error:"Invitation is invalid, expired, or for another email."},400);
    const exists=await env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE").bind(b.email.trim()).first();
    if(exists)return json({error:"This email already has an account. Please sign in."},409);
    const id=crypto.randomUUID(),pw=await createPasswordHash(b.password);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id,email,password_hash,password_salt) VALUES (?,?,?,?)").bind(id,b.email.trim().toLowerCase(),pw.hash,pw.salt),
      env.DB.prepare("INSERT INTO workspace_members (workspace_id,user_id,role) VALUES (?,?,?)").bind(inv.workspace_id,id,inv.role),
      env.DB.prepare("UPDATE team_invites SET accepted_at=? WHERE id=? AND accepted_at IS NULL").bind(new Date().toISOString(),inv.id)
    ]);
    return json({ok:true},201,{"set-cookie":cookie(await newSession(env,id))});
  }
  return null;
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
async function conversationsApi(request, env, session, path) {
  if (request.method !== "GET" && !allowedOrigin(request)) return json({ error: "Origin not allowed." },403);
  const base = "/api/conversations";
  if (path === base && request.method === "GET") {
    const result = await env.DB.prepare(`SELECT c.id,c.customer_name,c.customer_email,c.subject,c.status,c.tag,c.created_at,c.updated_at,
      (SELECT body FROM messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC LIMIT 1) AS preview
      FROM conversations c WHERE c.workspace_id=? ORDER BY c.updated_at DESC LIMIT 200`).bind(session.workspace_id).all();
    const conversations = await Promise.all((result.results || []).map(async row => {
      const messages = await env.DB.prepare("SELECT id,author_type,author_user_id,body,created_at FROM messages WHERE conversation_id=? ORDER BY created_at ASC LIMIT 500").bind(row.id).all();
      return { ...row, messages: messages.results || [] };
    }));
    return json({ conversations });
  }
  if (path === base && request.method === "POST") {
    if (!["owner","admin","agent"].includes(session.role)) return json({error:"You do not have permission to create conversations."},403);
    const b=await body(request);
    if(!b||typeof b.customer_name!=="string"||!b.customer_name.trim()||typeof b.subject!=="string"||!b.subject.trim())return json({error:"Customer name and subject are required."},400);
    const id=crypto.randomUUID(),now=new Date().toISOString();
    await env.DB.prepare("INSERT INTO conversations (id,workspace_id,customer_name,customer_email,subject,tag,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(id,session.workspace_id,b.customer_name.trim().slice(0,120),validEmail(b.customer_email)?b.customer_email.trim().toLowerCase():null,b.subject.trim().slice(0,240),typeof b.tag==="string"?b.tag.slice(0,60):"General",now,now).run();
    if(typeof b.message==="string"&&b.message.trim())await env.DB.prepare("INSERT INTO messages (id,conversation_id,author_type,body,created_at) VALUES (?,?,'customer',?,?)").bind(crypto.randomUUID(),id,b.message.trim().slice(0,20000),now).run();
    return json({ok:true,id},201);
  }
  const messageMatch=path.match(/^\/api\/conversations\/([^/]+)\/messages$/);
  if(messageMatch){
    const id=decodeURIComponent(messageMatch[1]);
    const conversation=await env.DB.prepare("SELECT id FROM conversations WHERE id=? AND workspace_id=?").bind(id,session.workspace_id).first();
    if(!conversation)return json({error:"Conversation not found."},404);
    if(request.method==="GET"){
      const rows=await env.DB.prepare("SELECT id,author_type,author_user_id,body,created_at FROM messages WHERE conversation_id=? ORDER BY created_at ASC LIMIT 500").bind(id).all();
      return json({messages:rows.results||[]});
    }
    if(request.method==="POST"){
      if(!["owner","admin","agent"].includes(session.role))return json({error:"You do not have permission to reply."},403);
      const b=await body(request);
      if(typeof b?.body!=="string"||!b.body.trim()||b.body.length>20000)return json({error:"Message must contain between 1 and 20000 characters."},400);
      const now=new Date().toISOString(),messageId=crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO messages (id,conversation_id,author_type,author_user_id,body,created_at) VALUES (?,?,'agent',?,?,?)").bind(messageId,id,session.user_id,b.body.trim(),now),
        env.DB.prepare("UPDATE conversations SET status='pending',updated_at=? WHERE id=? AND workspace_id=?").bind(now,id,session.workspace_id)
      ]);
      return json({ok:true,id:messageId,created_at:now},201);
    }
  }
  const conversationMatch=path.match(/^\/api\/conversations\/([^/]+)$/);
  if(conversationMatch&&request.method==="PATCH"){
    if(!["owner","admin","agent"].includes(session.role))return json({error:"You do not have permission to update conversations."},403);
    const id=decodeURIComponent(conversationMatch[1]),b=await body(request);
    if(!["open","pending","resolved"].includes(b?.status))return json({error:"Invalid conversation status."},400);
    const result=await env.DB.prepare("UPDATE conversations SET status=?,updated_at=? WHERE id=? AND workspace_id=?").bind(b.status,new Date().toISOString(),id,session.workspace_id).run();
    if(!result.meta?.changes)return json({error:"Conversation not found."},404);
    return json({ok:true});
  }
  return json({error:"Not found."},404);
}

function securePage(response) {
  const headers=new Headers(response.headers);
  headers.set("cache-control","no-store");
  headers.set("x-frame-options","DENY");
  headers.set("x-content-type-options","nosniff");
  headers.set("referrer-policy","strict-origin-when-cross-origin");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
function publicAsset(path) { return path.startsWith("/_next/")||["/icon.svg","/manifest.webmanifest","/sw.js","/favicon.ico"].includes(path)||/\.(png|jpg|jpeg|svg|webp|ico|css|js|woff2?)$/i.test(path); }
export default {
  async fetch(request,env) {
    const url=new URL(request.url),path=url.pathname.replace(/\/$/,"")||"/";
    if(path==="/api/health"&&request.method==="GET")return json({service:"ResolveAI",status:"ok",mode:"private-team",database_configured:Boolean(env.DB),password_hash_version:"argon2id-v19-m19456-t2-p1-UNBUILT"});
    if(path.startsWith("/api/auth/")){const result=await auth(request,env,path);if(result)return result;}
    if(path.startsWith("/api/")){
      if(!env.DB)return json({error:"Database binding DB is not configured."},503);
      const session=await sessionFor(request,env);
      if(!session)return json({error:"Authentication required."},401);
      if(path==="/api/auth/me"&&request.method==="GET")return json({user:{id:session.user_id,email:session.email},workspace:{id:session.workspace_id,name:session.workspace_name},role:session.role});
      if(path==="/api/auth/invites"&&request.method==="POST"){
        if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
        if(!["owner","admin"].includes(session.role))return json({error:"Only workspace admins can invite members."},403);
        const b=await body(request),email=b?.email,role=b?.role;
        if(!validEmail(email)||!["admin","agent","viewer"].includes(role))return json({error:"Provide a valid email and role."},400);
        const token=randomToken(),expires=new Date(Date.now()+7*86400000).toISOString();
        await env.DB.prepare("INSERT INTO team_invites (id,workspace_id,email,role,token_hash,expires_at,created_by_user_id) VALUES (?,?,?,?,?,?,?)")
          .bind(crypto.randomUUID(),session.workspace_id,email.trim().toLowerCase(),role,await digest(token),expires,session.user_id).run();
        return json({ok:true,invite_url:new URL("/login/?invite="+encodeURIComponent(token),request.url).toString(),expires_at:expires},201);
      }
      if(path==="/api/ai")return analyze(request);
      if(path==="/api/conversations"||path.startsWith("/api/conversations/"))return conversationsApi(request,env,session,path);
      return json({error:"Not found."},404);
    }
    if(path==="/login"){
      const session=await sessionFor(request,env);
      return session?Response.redirect(new URL("/",request.url),302):securePage(await env.ASSETS.fetch(request));
    }
    if(path==="/website"||path==="/qr")return securePage(await env.ASSETS.fetch(request));
    if(publicAsset(path))return env.ASSETS.fetch(request);
    const session=await sessionFor(request,env);
    if(!session)return Response.redirect(new URL("/login/",request.url),302);
    return securePage(await env.ASSETS.fetch(request));
  }
};
