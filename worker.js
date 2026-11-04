import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
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
CREATE TABLE IF NOT EXISTS membership_requests (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT, phone TEXT, identity_number TEXT, unit_code TEXT, unit_details TEXT,
  resident_type TEXT, payment_method TEXT, payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'not_submitted' CHECK(status IN ('not_submitted','pending','approved','rejected')),
  reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT, review_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_membership_requests_status ON membership_requests(status,updated_at);
CREATE TABLE IF NOT EXISTS unit_workspaces (
  unit_code TEXT PRIMARY KEY COLLATE NOCASE,
  workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS block_admins (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO block_admins (user_id)
SELECT owner_user_id FROM workspaces ORDER BY created_at LIMIT 1;
INSERT OR IGNORE INTO block_admins (user_id)
SELECT user_id FROM workspace_members
WHERE workspace_id=(SELECT id FROM workspaces ORDER BY created_at LIMIT 1)
  AND role IN ('owner','admin');

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id,expires_at);
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_email ON password_reset_requests(email_hash,created_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_ip ON password_reset_requests(ip_hash,created_at);
`;
let schemaPromise;
async function ensureSchema(env) {
  if (!env.DB) throw new Error("Database binding DB is not configured.");
  if (!schemaPromise) {
    const statements = SCHEMA_SQL.split(';').map(statement => statement.trim()).filter(Boolean);
    schemaPromise = env.DB.batch(statements.map(statement => env.DB.prepare(statement))).catch(error => { schemaPromise = null; throw error; });
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
function decode64url(s) { const normalized=String(s).replace(/-/g,"+").replace(/_/g,"/").replace(/=+$/,""); const b=atob(normalized+"=".repeat((4-normalized.length%4)%4)); return Uint8Array.from(b,c=>c.charCodeAt(0)); }
async function passwordHash(password, saltText) {
  let stage = "salt_decode";
  try {
    const salt = saltText ? decode64url(saltText) : crypto.getRandomValues(new Uint8Array(16));
    if (!(salt instanceof Uint8Array) || salt.length < 8 || salt.length > 64) throw new Error("Invalid stored salt length");
    stage = "pbkdf2_noble";
    // Cloudflare Workers caps native PBKDF2 at 100,000 iterations. Noble's
    // audited pure-JS implementation preserves the legacy 310,000 format.
    const bits = await pbkdf2Async(
      sha256,
      new TextEncoder().encode(String(password)),
      salt,
      { c: 310000, dkLen: 32 }
    );
    stage = "hash_encoding";
    if (!bits || bits.length !== 32) throw new Error("PBKDF2 returned an unexpected key length");
    let encoded=""; for(const n of bits)encoded+=String.fromCharCode(n);
    let saltBinary=""; for(const n of salt)saltBinary+=String.fromCharCode(n);
    return {
      hash:btoa(encoded).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_"),
      salt:btoa(saltBinary).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")
    };
  } catch (error) {
    const wrapped = new Error("Password verification failed during " + stage);
    wrapped.code = "PASSWORD_" + stage.toUpperCase() + "_FAILED";
    console.error("ResolveAI password hashing stage failed", {stage, name:error?.name || "Error"});
    throw wrapped;
  }
}
const validEmail = v => typeof v==="string" && v.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const validPassword = v => typeof v==="string" && v.length>=12 && v.length<=128;
const allowedOrigin = r => !r.headers.get("Origin") || r.headers.get("Origin")===new URL(r.url).origin;
async function body(r){try{return await r.json()}catch{return null}}
async function sessionFor(request,env) {
  if(!env.DB)return null;
  const authorization=request.headers.get("Authorization")||"";
  const bearer=authorization.startsWith("Bearer ")?authorization.slice(7).trim():null;
  const token=bearer||getCookie(request); if(!token||token.length>200)return null;
  const tokenHash=await digest(token);
  const expiresAt=new Date().toISOString();
  const requestedWorkspace=(request.headers.get("X-ResolveAI-Workspace")||"").trim()||null;
  try {
    return await env.DB.prepare(`SELECT u.id AS user_id,u.email,w.id AS workspace_id,w.name AS workspace_name,wm.role,
      COALESCE(mr.status,'approved') AS membership_status
      FROM sessions s JOIN users u ON u.id=s.user_id JOIN workspace_members wm ON wm.user_id=u.id
      JOIN workspaces w ON w.id=wm.workspace_id LEFT JOIN membership_requests mr ON mr.user_id=u.id
      WHERE s.token_hash=? AND s.expires_at>? AND (? IS NULL OR w.id=?)
      ORDER BY wm.created_at LIMIT 1`)
      .bind(tokenHash,expiresAt,requestedWorkspace,requestedWorkspace).first();
  } catch(error) {
    // Older workspaces do not have membership tables yet. Existing users remain
    // approved in their current workspace; do not run DDL just to validate a session.
    const message=String(error?.message||error||"").toLowerCase();
    if(!message.includes("membership_requests") || !message.includes("no such table")) throw error;
    return await env.DB.prepare(`SELECT u.id AS user_id,u.email,w.id AS workspace_id,w.name AS workspace_name,wm.role,
      'approved' AS membership_status
      FROM sessions s JOIN users u ON u.id=s.user_id JOIN workspace_members wm ON wm.user_id=u.id
      JOIN workspaces w ON w.id=wm.workspace_id
      WHERE s.token_hash=? AND s.expires_at>? AND (? IS NULL OR w.id=?)
      ORDER BY wm.created_at LIMIT 1`)
      .bind(tokenHash,expiresAt,requestedWorkspace,requestedWorkspace).first();
  }
}
async function isBlockAdmin(env,userId) {
  const row=await env.DB.prepare("SELECT 1 AS ok FROM block_admins WHERE user_id=?").bind(userId).first();
  return Number(row?.ok||0)===1;
}
async function ensureUnitWorkspace(env, unitCode, adminUserId) {
  const normalized = String(unitCode || "").trim().toUpperCase();
  if (!normalized) throw new Error("Unit code is required before approval.");
  let link = await env.DB.prepare("SELECT workspace_id FROM unit_workspaces WHERE unit_code=? COLLATE NOCASE").bind(normalized).first();
  if (!link?.workspace_id) {
    const workspaceId = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO workspaces (id,name,owner_user_id) VALUES (?,?,?)")
          .bind(workspaceId, "Unit " + normalized, adminUserId),
        env.DB.prepare("INSERT INTO unit_workspaces (unit_code,workspace_id) VALUES (?,?)")
          .bind(normalized, workspaceId)
      ]);
    } catch (error) {
      // A concurrent approval for the same unit may have created the mapping.
      link = await env.DB.prepare("SELECT workspace_id FROM unit_workspaces WHERE unit_code=? COLLATE NOCASE").bind(normalized).first();
      if (!link?.workspace_id) throw error;
    }
    if (!link?.workspace_id) {
      link = await env.DB.prepare("SELECT workspace_id FROM unit_workspaces WHERE unit_code=? COLLATE NOCASE").bind(normalized).first();
    }
  }
  if (!link?.workspace_id) throw new Error("Could not create the private unit workspace.");
  await env.DB.prepare(`INSERT INTO workspace_members (workspace_id,user_id,role) VALUES (?,?,'admin')
    ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=CASE WHEN workspace_members.role='owner' THEN 'owner' ELSE 'admin' END`)
    .bind(link.workspace_id,adminUserId).run();
  return link.workspace_id;
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
    // This is a read-only bootstrap probe. The existing users table is present
    // for any installed ResolveAI workspace; do not run DDL on the login screen.
    try {
      const n=await env.DB.prepare("SELECT COUNT(*) AS total FROM users").first();
      return json({setup_required:Number(n?.total||0)===0,setup_enabled:Boolean(env.RESOLVEAI_SETUP_TOKEN)});
    } catch(error) {
      const message=String(error?.message||error||"").toLowerCase();
      if(message.includes("no such table") && message.includes("users")) {
        return json({setup_required:true,setup_enabled:Boolean(env.RESOLVEAI_SETUP_TOKEN)});
      }
      throw error;
    }
  }
  if(path==="/api/auth/password-reset/request"&&request.method==="POST"){
    if(!env.DB)return json({error:"Database binding DB is not configured."},503);
    await ensureSchema(env);
    if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
    if((!env.EMAIL?.send&&!env.RESEND_API_KEY)||!env.RESOLVEAI_FROM_EMAIL)return json({error:"Password reset email is not configured yet. Please contact the site administrator."},503);
    const b=await body(request),email=validEmail(b?.email)?b.email.trim().toLowerCase():null;
    if(!email)return json({error:"Enter a valid email address."},400);

    // Use a configured canonical URL so an attacker-controlled Host header
    // can never redirect a password-reset token to another website.
    let publicOrigin;
    try {
      const publicUrl=new URL(String(env.RESOLVEAI_PUBLIC_URL||""));
      if(publicUrl.protocol!=="https:"||publicUrl.username||publicUrl.password||publicUrl.search||publicUrl.hash)throw new Error("Invalid public URL");
      publicOrigin=publicUrl.origin;
    } catch {
      return json({error:"Password reset is not configured correctly. Please contact the site administrator."},503);
    }

    const now=Date.now(),nowIso=new Date(now).toISOString(),windowStart=new Date(now-15*60*1000).toISOString();
    const emailHash=await digest(email);
    const ipHash=await digest(request.headers.get("CF-Connecting-IP")||"unknown");
    await env.DB.prepare("DELETE FROM password_reset_requests WHERE created_at<?").bind(new Date(now-24*60*60*1000).toISOString()).run();
    const [emailAttempts,ipAttempts]=await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS total FROM password_reset_requests WHERE email_hash=? AND created_at>?").bind(emailHash,windowStart).first(),
      env.DB.prepare("SELECT COUNT(*) AS total FROM password_reset_requests WHERE ip_hash=? AND created_at>?").bind(ipHash,windowStart).first()
    ]);
    const genericMessage="If an account exists for that email, a password reset link will be sent shortly. Check your inbox and spam folder.";
    if(Number(emailAttempts?.total||0)>=3||Number(ipAttempts?.total||0)>=10)return json({ok:true,message:genericMessage});
    await env.DB.prepare("INSERT INTO password_reset_requests (id,email_hash,ip_hash,created_at) VALUES (?,?,?,?)")
      .bind(crypto.randomUUID(),emailHash,ipHash,nowIso).run();

    const user=await env.DB.prepare("SELECT id,email FROM users WHERE email=? COLLATE NOCASE").bind(email).first();
    if(!user)return json({ok:true,message:genericMessage});

    await env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id=?").bind(user.id).run();
    const resetToken=randomToken(),tokenHash=await digest(resetToken);
    const expiresAt=new Date(now+30*60*1000).toISOString();
    await env.DB.prepare("INSERT INTO password_reset_tokens (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)")
      .bind(crypto.randomUUID(),user.id,tokenHash,expiresAt).run();
    const resetUrl=new URL("/login/?reset_token="+encodeURIComponent(resetToken),publicOrigin).toString();
    const html="<div style='font-family:Arial,sans-serif;line-height:1.6;color:#172033'><h2>Reset your ResolveAI password</h2><p>We received a request to create a new password for your ResolveAI account.</p><p><a href='"+resetUrl+"' style='display:inline-block;padding:12px 18px;background:#172033;color:#fff;text-decoration:none;border-radius:8px'>Create a new password</a></p><p>This link expires in 30 minutes and can be used once. If you did not request this change, you can ignore this email.</p></div>";
    try {
      const message={
        from:env.RESOLVEAI_FROM_EMAIL,
        to:user.email,
        subject:"Reset your ResolveAI password",
        html,
        text:"Reset your ResolveAI password using this link: "+resetUrl+"\\n\\nThe link expires in 30 minutes and can be used once. If you did not request this change, ignore this email."
      };
      if(env.EMAIL?.send){
        // Prefer Cloudflare Email Service when the Preview binding is enabled.
        await env.EMAIL.send(message);
      }else{
        // Resend remains available as an optional provider fallback.
        const delivery=await fetch("https://api.resend.com/emails",{
          method:"POST",
          headers:{
            "Authorization":"Bearer "+env.RESEND_API_KEY,
            "Content-Type":"application/json",
            "User-Agent":"ResolveAI/1.0",
            "Idempotency-Key":"resolveai-password-reset-"+tokenHash
          },
          body:JSON.stringify({...message,to:[user.email]})
        });
        if(!delivery.ok)throw new Error("Resend email delivery failed with HTTP "+delivery.status);
      }
    } catch(error) {
      await env.DB.prepare("DELETE FROM password_reset_tokens WHERE token_hash=?").bind(tokenHash).run();
      console.error("ResolveAI password-reset email request failed",{name:error?.name||"Error"});
      // Do not disclose whether the address exists if the mail provider fails.
      return json({ok:true,message:genericMessage});
    }
    return json({ok:true,message:genericMessage});
  }
  if(path==="/api/auth/password-reset/complete"&&request.method==="POST"){
    if(!env.DB)return json({error:"Database binding DB is not configured."},503);
    await ensureSchema(env);
    if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
    const b=await body(request);
    if(typeof b?.token!=="string"||b.token.length<32||b.token.length>128||!validPassword(b.password))
      return json({error:"This reset link is invalid or expired, or the new password does not meet the requirements."},400);
    const tokenHash=await digest(b.token),now=new Date().toISOString();
    const record=await env.DB.prepare("SELECT id,user_id FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>?")
      .bind(tokenHash,now).first();
    if(!record)return json({error:"This reset link is invalid or expired. Request a new password reset link."},400);
    const nextPassword=await passwordHash(b.password);
    const results=await env.DB.batch([
      env.DB.prepare("UPDATE password_reset_tokens SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at>?")
        .bind(now,record.id,now),
      env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM password_reset_tokens WHERE id=? AND used_at=?)")
        .bind(nextPassword.hash,nextPassword.salt,now,record.user_id,record.id,now),
      env.DB.prepare("DELETE FROM sessions WHERE user_id=? AND EXISTS (SELECT 1 FROM password_reset_tokens WHERE id=? AND used_at=?)")
        .bind(record.user_id,record.id,now),
      env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id=? AND id<>?")
        .bind(record.user_id,record.id)
    ]);
    if(!results[0]?.meta?.changes||!results[1]?.meta?.changes)
      return json({error:"This reset link was already used or has expired. Request a new password reset link."},400);
    return json({ok:true,message:"Your password has been updated. Please sign in with your new password."});
  }
  if(path==="/api/auth/logout"&&request.method==="POST"){
    if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
    const authHeader=request.headers.get("Authorization")||"";
    const bearer=authHeader.startsWith("Bearer ")?authHeader.slice(7).trim():null;
    const token=getCookie(request)||bearer; if(env.DB&&token)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(token)).run();
    return json({ok:true},200,{"set-cookie":cookie("",0)});
  }
  if(!env.DB)return json({error:"Database binding DB is not configured."},503);
  if(path==="/api/auth/setup"&&request.method==="POST"){
    await ensureSchema(env);
    if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
    if(!env.RESOLVEAI_SETUP_TOKEN)return json({error:"Set the RESOLVEAI_SETUP_TOKEN secret before initial setup."},503);
    const b=await body(request);
    if(!b||!equal(String(b.setup_token||""),env.RESOLVEAI_SETUP_TOKEN))return json({error:"Invalid setup token."},403);
    if(!validEmail(b.email)||!validPassword(b.password))return json({error:"Enter a valid email and a password with at least 12 characters."},400);
    const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM users").first();
    if(Number(count?.total||0)!==0)return json({error:"Initial setup has already been completed."},409);
    const id=crypto.randomUUID(),wid=crypto.randomUUID(),pw=await passwordHash(b.password);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id,email,password_hash,password_salt) VALUES (?,?,?,?)").bind(id,b.email.trim().toLowerCase(),pw.hash,pw.salt),
      env.DB.prepare("INSERT INTO workspaces (id,name,owner_user_id) VALUES (?,?,?)").bind(wid,(b.workspace_name||"My team").toString().slice(0,80),id),
      env.DB.prepare("INSERT INTO workspace_members (workspace_id,user_id,role) VALUES (?,?,'owner')").bind(wid,id),
      env.DB.prepare("INSERT OR IGNORE INTO block_admins (user_id) VALUES (?)").bind(id)
    ]);
    return json({ok:true},201,{"set-cookie":cookie(await newSession(env,id))});
  }
  if(path==="/api/auth/register"&&request.method==="POST"){
    await ensureSchema(env);
    if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
    const b=await body(request);
    if(!b||!validEmail(b.email)||!validPassword(b.password))return json({error:"Enter a valid email and a password with at least 12 characters."},400);
    const ip=request.headers.get("CF-Connecting-IP")||"unknown",key="register:"+ip,now=Date.now();
    const attempts=(requestWindows.get(key)||[]).filter(t=>now-t<3600000);
    if(attempts.length>=5)return json({error:"Too many registration attempts. Try again later."},429);
    attempts.push(now);requestWindows.set(key,attempts);
    const exists=await env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE").bind(b.email.trim()).first();
    if(exists)return json({error:"An account with this email already exists. Please sign in."},409);
    const workspace=await env.DB.prepare("SELECT id FROM workspaces ORDER BY created_at LIMIT 1").first();
    if(!workspace)return json({error:"The site administrator must complete initial setup before public registration."},503);
    const id=crypto.randomUUID(),pw=await passwordHash(b.password);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id,email,password_hash,password_salt) VALUES (?,?,?,?)").bind(id,b.email.trim().toLowerCase(),pw.hash,pw.salt),
      env.DB.prepare("INSERT INTO workspace_members (workspace_id,user_id,role) VALUES (?,?,'viewer')").bind(workspace.id,id),
      env.DB.prepare("INSERT INTO membership_requests (user_id,status) VALUES (?,'not_submitted')").bind(id)
    ]);
    return json({ok:true,requires_membership:true},201,{"set-cookie":cookie(await newSession(env,id))});
  }
  if(path==="/api/auth/login"&&request.method==="POST"){
    let loginStage="request_validation";
    try {
      if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
      const b=await body(request);
      if(!b||!validEmail(b.email)||typeof b.password!=="string")return json({error:"Enter your email and password."},400);
      const ip=request.headers.get("CF-Connecting-IP")||"unknown",key="login:"+ip+":"+b.email.trim().toLowerCase(),now=Date.now();
      const attempts=(requestWindows.get(key)||[]).filter(t=>now-t<60000);
      if(attempts.length>=10)return json({error:"Too many sign-in attempts. Wait a minute and try again."},429);
      attempts.push(now);requestWindows.set(key,attempts);
      loginStage="account_lookup";
      const u=await env.DB.prepare("SELECT id,password_hash,password_salt FROM users WHERE email=? COLLATE NOCASE").bind(b.email.trim()).first();
      if(!u)return json({error:"Email or password is incorrect."},401);
      loginStage="password_verification";
      const pw=await passwordHash(b.password,u.password_salt);
      if(!equal(pw.hash,u.password_hash))return json({error:"Email or password is incorrect."},401);
      loginStage="session_creation";
      const sessionToken=await newSession(env,u.id);
      if(request.headers.get("X-ResolveAI-Client")==="mobile")return json({ok:true,access_token:sessionToken,expires_in:SESSION_SECONDS});
      return json({ok:true},200,{"set-cookie":cookie(sessionToken)});
    } catch(error) {
      const innerCode = typeof error?.code === "string" && /^PASSWORD_(SALT_DECODE|PBKDF2|HASH_ENCODING)_FAILED$/.test(error.code)
        ? "AUTH_" + error.code
        : "AUTH_" + loginStage.toUpperCase() + "_ERROR";
      console.error("ResolveAI login stage failed", {stage:loginStage,code:innerCode,name:error?.name || "Error"});
      return json({error:"The authentication service encountered an internal error. Please share the diagnostic code with the site maintainer.",code:innerCode},500);
    }
  }
  if(path==="/api/auth/accept-invite"&&request.method==="POST"){
    await ensureSchema(env);
    if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
    const b=await body(request);
    if(!b||typeof b.invite_token!=="string"||!validEmail(b.email)||!validPassword(b.password))return json({error:"Invitation, valid email and password (12+ characters) are required."},400);
    const inv=await env.DB.prepare("SELECT id,workspace_id,email,role FROM team_invites WHERE token_hash=? AND accepted_at IS NULL AND expires_at>?").bind(await digest(b.invite_token),new Date().toISOString()).first();
    if(!inv||String(inv.email).toLowerCase()!==b.email.trim().toLowerCase())return json({error:"Invitation is invalid, expired, or for another email."},400);
    const exists=await env.DB.prepare("SELECT id FROM users WHERE email=? COLLATE NOCASE").bind(b.email.trim()).first();
    if(exists)return json({error:"This email already has an account. Please sign in."},409);
    const id=crypto.randomUUID(),pw=await passwordHash(b.password);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id,email,password_hash,password_salt) VALUES (?,?,?,?)").bind(id,b.email.trim().toLowerCase(),pw.hash,pw.salt),
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
    if(path==="/api/health"&&request.method==="GET")return json({service:"ResolveAI",status:"ok",mode:"private-team",database_configured:Boolean(env.DB)});
    if(path==="/api/health/db"&&request.method==="GET"){
      if(!env.DB)return json({service:"ResolveAI",status:"error",database:"not_configured"},503);
      try {
        const probe=await env.DB.prepare("SELECT 1 AS ok").first();
        if(Number(probe?.ok)!==1)throw new Error("Unexpected D1 probe result");
        return json({service:"ResolveAI",status:"ok",database:"reachable"});
      } catch(error) {
        console.error("ResolveAI read-only D1 health probe failed",error);
        return json({service:"ResolveAI",status:"error",database:"unreachable"},503);
      }
    }
    if(path.startsWith("/api/auth/")){
      try {
        const result=await auth(request,env,path);
        if(result)return result;
      } catch(error) {
        console.error("ResolveAI authentication request failed", error);
        return json({error:"The authentication service encountered an internal error. Please try again shortly.",code:"AUTH_RUNTIME_ERROR"},500);
      }
    }
    if(path.startsWith("/api/")){
      if(!env.DB)return json({error:"Database binding DB is not configured."},503);
      const session=await sessionFor(request,env);
      if(!session)return json({error:"Authentication required."},401);
      if(path!=="/api/auth/me")await ensureSchema(env);
      if(path==="/api/auth/me"&&request.method==="GET")return json({user:{id:session.user_id,email:session.email},workspace:{id:session.workspace_id,name:session.workspace_name},role:session.role,membership_status:session.membership_status});
      if(path==="/api/workspaces"&&request.method==="GET"){
        const blockAdmin=await isBlockAdmin(env,session.user_id);
        if(blockAdmin){
          await env.DB.prepare(`INSERT INTO workspace_members (workspace_id,user_id,role)
            SELECT workspace_id,?,'admin' FROM unit_workspaces WHERE 1
            ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=CASE WHEN workspace_members.role='owner' THEN 'owner' ELSE 'admin' END`).bind(session.user_id).run();
        }
        const rows=await env.DB.prepare(`SELECT w.id,w.name,uw.unit_code,wm.role
          FROM workspace_members wm JOIN workspaces w ON w.id=wm.workspace_id
          LEFT JOIN unit_workspaces uw ON uw.workspace_id=w.id
          WHERE wm.user_id=? ORDER BY CASE WHEN uw.unit_code IS NULL THEN 0 ELSE 1 END,w.name COLLATE NOCASE`)
          .bind(session.user_id).all();
        return json({is_block_admin:blockAdmin,workspaces:(rows.results||[]).map(row=>({...row,is_current:row.id===session.workspace_id}))});
      }
      if(path==="/api/admin/legacy-members"&&request.method==="GET"){
        if(!await isBlockAdmin(env,session.user_id))return json({error:"Only the block administrator can map existing accounts."},403);
        const root=await env.DB.prepare("SELECT id FROM workspaces ORDER BY created_at LIMIT 1").first();
        if(!root)return json({users:[]});
        const rows=await env.DB.prepare(`SELECT u.id AS user_id,u.email,wm.role,w.name AS workspace_name
          FROM users u JOIN workspace_members wm ON wm.user_id=u.id
          JOIN workspaces w ON w.id=wm.workspace_id
          LEFT JOIN membership_requests mr ON mr.user_id=u.id
          WHERE wm.workspace_id=? AND mr.user_id IS NULL
            AND NOT EXISTS (SELECT 1 FROM block_admins ba WHERE ba.user_id=u.id)
          ORDER BY u.email COLLATE NOCASE LIMIT 500`).bind(root.id).all();
        return json({users:rows.results||[]});
      }
      const legacyPrefix="/api/admin/legacy-members/";
      if(path.startsWith(legacyPrefix)&&request.method==="PATCH"){
        if(!await isBlockAdmin(env,session.user_id))return json({error:"Only the block administrator can map existing accounts."},403);
        if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
        const b=await body(request),userId=decodeURIComponent(path.slice(legacyPrefix.length));
        const unitCode=typeof b?.unit_code==="string"?b.unit_code.trim().toUpperCase():"";
        if(!/^[A-Z0-9][A-Z0-9._-]{0,31}$/.test(unitCode))return json({error:"Enter a valid unit code (1–32 letters, digits, dots, underscores or hyphens)."},400);
        const root=await env.DB.prepare("SELECT id FROM workspaces ORDER BY created_at LIMIT 1").first();
        if(!root)return json({error:"The main workspace could not be found."},404);
        const legacy=await env.DB.prepare(`SELECT wm.role FROM workspace_members wm
          LEFT JOIN membership_requests mr ON mr.user_id=wm.user_id
          WHERE wm.workspace_id=? AND wm.user_id=? AND mr.user_id IS NULL`).bind(root.id,userId).first();
        if(!legacy)return json({error:"This account is not an unmapped legacy account in the main workspace."},404);
        const unitWorkspace=await ensureUnitWorkspace(env,unitCode,session.user_id);
        const reviewedAt=new Date().toISOString();
        await env.DB.batch([
          env.DB.prepare(`INSERT INTO workspace_members (workspace_id,user_id,role) VALUES (?,?,'agent')
            ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=CASE WHEN workspace_members.role IN ('owner','admin') THEN workspace_members.role ELSE 'agent' END`)
            .bind(unitWorkspace,userId),
          env.DB.prepare(`DELETE FROM workspace_members WHERE workspace_id=? AND user_id=? AND role NOT IN ('owner','admin')
            AND EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id=? AND user_id=?)`)
            .bind(root.id,userId,unitWorkspace,userId),
          env.DB.prepare(`INSERT INTO membership_requests (user_id,unit_code,status,reviewed_by_user_id,reviewed_at,review_note,updated_at)
            VALUES (?,?,'approved',?,?,?,?)
            ON CONFLICT(user_id) DO UPDATE SET unit_code=excluded.unit_code,status='approved',reviewed_by_user_id=excluded.reviewed_by_user_id,reviewed_at=excluded.reviewed_at,review_note=excluded.review_note,updated_at=excluded.updated_at`)
            .bind(userId,unitCode,session.user_id,reviewedAt,"Mapped from the existing account roster by the block administrator.",reviewedAt)
        ]);
        return json({ok:true,user_id:userId,unit_code:unitCode,workspace_id:unitWorkspace});
      }
      if(path==="/api/membership"&&request.method==="GET"){
        const own=await env.DB.prepare("SELECT full_name,phone,identity_number,unit_code,unit_details,resident_type,payment_method,payment_reference,status,review_note,updated_at FROM membership_requests WHERE user_id=?").bind(session.user_id).first();
        if(await isBlockAdmin(env,session.user_id)){
          const rows=await env.DB.prepare("SELECT mr.user_id,u.email,mr.full_name,mr.phone,mr.identity_number,mr.unit_code,mr.unit_details,mr.resident_type,mr.payment_method,mr.payment_reference,mr.status,mr.created_at,mr.updated_at FROM membership_requests mr JOIN users u ON u.id=mr.user_id WHERE mr.status IN ('pending','rejected') ORDER BY mr.updated_at ASC LIMIT 200").all();
          return json({request:own,requests:rows.results||[]});
        }
        return json({request:own});
      }
      if(path==="/api/membership"&&request.method==="POST"){
        if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
        if(session.membership_status==="approved")return json({error:"Your membership is already approved."},409);
        const b=await body(request);
        const fields=["full_name","phone","identity_number","unit_code","unit_details","resident_type","payment_method","payment_reference"];
        if(!b||fields.some(k=>typeof b[k]!=="string")||!b.full_name.trim()||!b.phone.trim()||!b.identity_number.trim()||!b.unit_code.trim()||!b.unit_details.trim()||!["owner","tenant","family"].includes(b.resident_type)||!["bank_transfer","cash","other"].includes(b.payment_method)||!b.payment_reference.trim())return json({error:"Complete all required identity, unit and payment-reference fields."},400);
        const vals=fields.map(k=>String(b[k]).trim().slice(0,k==="unit_details"?500:160));
        await env.DB.prepare("INSERT INTO membership_requests (user_id,full_name,phone,identity_number,unit_code,unit_details,resident_type,payment_method,payment_reference,status,review_note,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'pending',NULL,?) ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name,phone=excluded.phone,identity_number=excluded.identity_number,unit_code=excluded.unit_code,unit_details=excluded.unit_details,resident_type=excluded.resident_type,payment_method=excluded.payment_method,payment_reference=excluded.payment_reference,status='pending',reviewed_by_user_id=NULL,reviewed_at=NULL,review_note=NULL,updated_at=excluded.updated_at").bind(session.user_id,...vals,new Date().toISOString()).run();
        return json({ok:true,status:"pending"},201);
      }
      const membershipReview=path.match(/^\/api\/membership\/([^/]+)$/);
      if(membershipReview&&request.method==="PATCH"){
        if(!await isBlockAdmin(env,session.user_id))return json({error:"Only the registered block administrator can review memberships."},403);
        if(!allowedOrigin(request))return json({error:"Origin not allowed."},403);
        const b=await body(request),userId=decodeURIComponent(membershipReview[1]);
        if(!["approved","rejected"].includes(b?.status))return json({error:"Choose approve or reject."},400);
        const requestRow=await env.DB.prepare("SELECT unit_code FROM membership_requests WHERE user_id=? AND status IN ('pending','rejected')").bind(userId).first();
        if(!requestRow)return json({error:"Pending membership request not found."},404);
        const reviewedAt=new Date().toISOString();
        if(b.status==="approved"){
          const unitWorkspaceId=await ensureUnitWorkspace(env,requestRow.unit_code,session.user_id);
          const result=await env.DB.batch([
            env.DB.prepare("UPDATE membership_requests SET status='approved',reviewed_by_user_id=?,reviewed_at=?,review_note=?,updated_at=? WHERE user_id=? AND status IN ('pending','rejected') AND EXISTS (SELECT 1 FROM workspace_members WHERE user_id=?)")
              .bind(session.user_id,reviewedAt,typeof b.note==="string"?b.note.trim().slice(0,500):null,reviewedAt,userId,userId),
            env.DB.prepare("UPDATE workspace_members SET workspace_id=?,role=CASE WHEN role IN ('owner','admin') THEN role ELSE 'agent' END WHERE user_id=? AND EXISTS (SELECT 1 FROM membership_requests WHERE user_id=? AND status='approved' AND reviewed_by_user_id=? AND reviewed_at=?)")
              .bind(unitWorkspaceId,userId,userId,session.user_id,reviewedAt)
          ]);
          if(!result[0]?.meta?.changes || !result[1]?.meta?.changes)return json({error:"Could not move the member into the private unit workspace. The request has not been activated; refresh and retry."},409);
        } else {
          const result=await env.DB.prepare("UPDATE membership_requests SET status='rejected',reviewed_by_user_id=?,reviewed_at=?,review_note=?,updated_at=? WHERE user_id=? AND status IN ('pending','rejected')")
            .bind(session.user_id,reviewedAt,typeof b.note==="string"?b.note.trim().slice(0,500):null,reviewedAt,userId).run();
          if(!result.meta?.changes)return json({error:"Membership request changed before review. Refresh and retry."},409);
        }
        return json({ok:true,status:b.status});
      }
      if(session.membership_status!=="approved")return json({error:"Complete your unit membership form and wait for block administrator approval.",membership_required:true},403);
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
      if(path==="/api/conversations"||path.startsWith("/api/conversations/"))return conversationsApi(request,env,session,path);
      return json({error:"Not found."},404);
    }
    if(path==="/membership"||path==="/admin/memberships"){
      const session=await sessionFor(request,env);
      if(!session)return Response.redirect(new URL("/login/",request.url),302);
      await ensureSchema(env);
      if(path==="/admin/memberships"&&!await isBlockAdmin(env,session.user_id))return new Response("Forbidden",{status:403});
      if(path==="/membership"&&session.membership_status==="approved")return Response.redirect(new URL("/",request.url),302);
      return securePage(await env.ASSETS.fetch(request));
    }
    if(path==="/login"){
      // Password-reset links must remain reachable even when the browser still
      // has a valid session cookie. The reset completion revokes old sessions.
      if(new URL(request.url).searchParams.has("reset_token"))
        return securePage(await env.ASSETS.fetch(request));
      const session=await sessionFor(request,env);
      return session?Response.redirect(new URL(session.membership_status==="approved"?"/":"/membership/",request.url),302):securePage(await env.ASSETS.fetch(request));
    }
    if(path==="/website"||path==="/qr")return securePage(await env.ASSETS.fetch(request));
    if(publicAsset(path))return env.ASSETS.fetch(request);
    const session=await sessionFor(request,env);
    if(!session)return Response.redirect(new URL("/login/",request.url),302);
    if(session.membership_status!=="approved")return Response.redirect(new URL("/membership/",request.url),302);
    return securePage(await env.ASSETS.fetch(request));
  }
};
