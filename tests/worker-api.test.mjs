import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import worker from "../worker.js";

const BASE = "https://resolveai-test.example";
const SESSION_TOKEN = "test-session-token";
const SESSION_HASH = createHash("sha256").update(SESSION_TOKEN).digest("base64url");

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.params = [];
  }
  bind(...params) {
    this.params = params;
    return this;
  }
  async first() {
    return this.db.first(this.sql, this.params);
  }
  async all() {
    return this.db.all(this.sql, this.params);
  }
  async run() {
    return this.db.run(this.sql, this.params);
  }
}

class FakeD1 {
  constructor(role = "owner") {
    this.role = role;
    this.user = {
      user_id: "test-owner-id",
      email: "owner@example.test",
      workspace_id: "test-workspace-id",
      workspace_name: "Test Workspace",
      role
    };
    this.conversations = new Map();
    this.messages = new Map();
    this.invites = [];
    this.authUser = null;
    this.passwordUpdates = 0;
    this.sessions = [];
  }

  async exec() {
    return { count: 0 };
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }

  async first(sql, params) {
    if (sql.includes("FROM sessions s JOIN users")) {
      if (params[0] !== SESSION_HASH) return null;
      return { ...this.user, role: this.role };
    }

    if (sql.startsWith("SELECT id,password_hash,password_salt FROM users WHERE email=")) {
      if (!this.authUser || this.authUser.email.toLowerCase() !== String(params[0]).toLowerCase()) return null;
      return { ...this.authUser };
    }

    if (sql.startsWith("SELECT id FROM conversations WHERE id=? AND workspace_id=?")) {
      const row = this.conversations.get(params[0]);
      return row && row.workspace_id === params[1] ? { id: row.id } : null;
    }

    throw new Error("Unexpected D1 first() query in test: " + sql);
  }

  async all(sql, params) {
    if (sql.includes("FROM conversations c WHERE c.workspace_id=?")) {
      const rows = [...this.conversations.values()]
        .filter(row => row.workspace_id === params[0])
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map(row => ({
          ...row,
          preview: (this.messages.get(row.id) || []).at(-1)?.body || null
        }));
      return { results: rows };
    }

    if (sql.startsWith("SELECT id,author_type,author_user_id,body,created_at FROM messages WHERE conversation_id=?")) {
      return { results: [...(this.messages.get(params[0]) || [])] };
    }

    throw new Error("Unexpected D1 all() query in test: " + sql);
  }

  async run(sql, params) {
    if (sql.startsWith("UPDATE users SET password_hash=?,password_salt=?,updated_at=? WHERE id=?")) {
      const [password_hash, password_salt, updated_at, id] = params;
      if (!this.authUser || this.authUser.id !== id) return { meta: { changes: 0 } };
      this.authUser = { ...this.authUser, password_hash, password_salt, updated_at };
      this.passwordUpdates += 1;
      return { meta: { changes: 1 } };
    }

    if (sql.startsWith("INSERT INTO sessions")) {
      const [id, user_id, token_hash, expires_at] = params;
      this.sessions.push({ id, user_id, token_hash, expires_at });
      return { meta: { changes: 1 } };
    }

    if (sql.startsWith("INSERT INTO conversations")) {
      const [id, workspace_id, customer_name, customer_email, subject, tag, created_at, updated_at] = params;
      this.conversations.set(id, {
        id, workspace_id, customer_name, customer_email, subject, status: "open",
        tag, created_at, updated_at
      });
      return { meta: { changes: 1 } };
    }

    if (sql.startsWith("INSERT INTO messages")) {
      const isAgent = sql.includes("'agent'");
      const message = isAgent
        ? { id: params[0], conversation_id: params[1], author_type: "agent", author_user_id: params[2], body: params[3], created_at: params[4] }
        : { id: params[0], conversation_id: params[1], author_type: "customer", author_user_id: null, body: params[2], created_at: params[3] };
      const messages = this.messages.get(message.conversation_id) || [];
      messages.push(message);
      this.messages.set(message.conversation_id, messages);
      return { meta: { changes: 1 } };
    }

    if (sql.startsWith("UPDATE conversations SET status='pending'")) {
      const [updated_at, id, workspace_id] = params;
      const row = this.conversations.get(id);
      if (row && row.workspace_id === workspace_id) {
        row.status = "pending";
        row.updated_at = updated_at;
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }

    if (sql.startsWith("UPDATE conversations SET status=?")) {
      const [status, updated_at, id, workspace_id] = params;
      const row = this.conversations.get(id);
      if (row && row.workspace_id === workspace_id) {
        row.status = status;
        row.updated_at = updated_at;
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }

    if (sql.startsWith("INSERT INTO team_invites")) {
      const [id, workspace_id, email, role, token_hash, expires_at, created_by_user_id] = params;
      this.invites.push({ id, workspace_id, email, role, token_hash, expires_at, created_by_user_id });
      return { meta: { changes: 1 } };
    }

    throw new Error("Unexpected D1 run() query in test: " + sql);
  }
}

function makeEnv(role = "owner") {
  return { DB: new FakeD1(role) };
}

function makeRequest(path, { method = "GET", body, authenticated = true, origin } = {}) {
  const headers = new Headers();
  if (authenticated) headers.set("cookie", "resolveai_session=" + SESSION_TOKEN);
  if (origin) headers.set("origin", origin);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function call(env, path, options) {
  return worker.fetch(makeRequest(path, options), env);
}

async function makeLegacyPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000
  }, key, 256);
  const toBase64Url = bytes => {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  };
  return { hash: toBase64Url(new Uint8Array(bits)), salt: toBase64Url(salt) };
}

test("successful legacy sign-in upgrades the stored PBKDF2 hash to Argon2id", async () => {
  const env = makeEnv("owner");
  const password = "Existing Preview owner password 2026!";
  const legacy = await makeLegacyPassword(password);
  env.DB.authUser = {
    id: "legacy-owner-id",
    email: "legacy-owner@example.test",
    password_hash: legacy.hash,
    password_salt: legacy.salt
  };

  const response = await call(env, "/api/auth/login", {
    method: "POST",
    authenticated: false,
    body: { email: env.DB.authUser.email, password }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.match(env.DB.authUser.password_hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.notEqual(env.DB.authUser.password_hash, legacy.hash);
  assert.notEqual(env.DB.authUser.password_salt, legacy.salt);
  assert.equal(env.DB.passwordUpdates, 1);
  assert.equal(env.DB.sessions.length, 1);
  assert.equal(env.DB.sessions[0].user_id, "legacy-owner-id");
  assert.match(response.headers.get("set-cookie") || "", /resolveai_session=/);
});

test("failed legacy sign-in never changes the password hash or creates a session", async () => {
  const env = makeEnv("owner");
  const legacy = await makeLegacyPassword("Correct password 2026!");
  env.DB.authUser = {
    id: "legacy-owner-id",
    email: "legacy-owner-wrong@example.test",
    password_hash: legacy.hash,
    password_salt: legacy.salt
  };

  const response = await call(env, "/api/auth/login", {
    method: "POST",
    authenticated: false,
    body: { email: env.DB.authUser.email, password: "wrong password" }
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Email or password is incorrect." });
  assert.equal(env.DB.authUser.password_hash, legacy.hash);
  assert.equal(env.DB.authUser.password_salt, legacy.salt);
  assert.equal(env.DB.passwordUpdates, 0);
  assert.equal(env.DB.sessions.length, 0);
});

test("private conversation endpoints reject requests without a session", async () => {
  const env = makeEnv();
  const response = await call(env, "/api/conversations", { authenticated: false });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Authentication required." });
});

test("owner can create a conversation and retrieve it with the first customer message", async () => {
  const env = makeEnv();
  const create = await call(env, "/api/conversations", {
    method: "POST",
    body: {
      customer_name: "Sam Taylor",
      customer_email: "sam@example.test",
      subject: "Package tracking",
      message: "Could you check my delivery?"
    }
  });

  assert.equal(create.status, 201);
  const created = await create.json();
  assert.equal(created.ok, true);
  assert.equal(typeof created.id, "string");

  const list = await call(env, "/api/conversations");
  assert.equal(list.status, 200);
  const data = await list.json();
  assert.equal(data.conversations.length, 1);
  assert.equal(data.conversations[0].id, created.id);
  assert.equal(data.conversations[0].customer_name, "Sam Taylor");
  assert.equal(data.conversations[0].status, "open");
  assert.equal(data.conversations[0].messages.length, 1);
  assert.equal(data.conversations[0].messages[0].author_type, "customer");
  assert.equal(data.conversations[0].messages[0].body, "Could you check my delivery?");
});

test("saving an agent reply persists the message and changes status to pending", async () => {
  const env = makeEnv();
  const create = await call(env, "/api/conversations", {
    method: "POST",
    body: { customer_name: "Sam Taylor", subject: "Package tracking", message: "Where is my package?" }
  });
  const { id } = await create.json();

  const reply = await call(env, "/api/conversations/" + id + "/messages", {
    method: "POST",
    body: { body: "I will check the carrier tracking and update you." }
  });
  assert.equal(reply.status, 201);

  const list = await call(env, "/api/conversations");
  const conversation = (await list.json()).conversations[0];
  assert.equal(conversation.status, "pending");
  assert.equal(conversation.messages.length, 2);
  assert.equal(conversation.messages[1].author_type, "agent");
  assert.equal(conversation.messages[1].body, "I will check the carrier tracking and update you.");

  const resolve = await call(env, "/api/conversations/" + id, {
    method: "PATCH",
    body: { status: "resolved" }
  });
  assert.equal(resolve.status, 200);

  const afterResolve = await call(env, "/api/conversations");
  assert.equal((await afterResolve.json()).conversations[0].status, "resolved");
});

test("owner can create a one-time team invitation without storing its raw token", async () => {
  const env = makeEnv("owner");
  const response = await call(env, "/api/auth/invites", {
    method: "POST",
    body: { email: "agent@example.test", role: "agent" }
  });

  assert.equal(response.status, 201);
  const data = await response.json();
  const inviteUrl = new URL(data.invite_url);
  const rawToken = inviteUrl.searchParams.get("invite");
  assert.equal(inviteUrl.pathname, "/login/");
  assert.ok(rawToken && rawToken.length > 20);
  assert.equal(typeof data.expires_at, "string");
  assert.equal(env.DB.invites.length, 1);
  assert.equal(env.DB.invites[0].email, "agent@example.test");
  assert.equal(env.DB.invites[0].role, "agent");
  assert.ok(env.DB.invites[0].token_hash);
  assert.notEqual(env.DB.invites[0].token_hash, rawToken);
});

test("team invitations reject cross-origin requests before creating an invite", async () => {
  const env = makeEnv("owner");
  const response = await call(env, "/api/auth/invites", {
    method: "POST",
    origin: "https://attacker.example",
    body: { email: "victim@example.test", role: "agent" }
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Origin not allowed." });
  assert.equal(env.DB.invites.length, 0);
});

test("conversation creation rejects cross-origin requests", async () => {
  const env = makeEnv("owner");
  const response = await call(env, "/api/conversations", {
    method: "POST",
    origin: "https://attacker.example",
    body: { customer_name: "Cross-site", subject: "Must not be created" }
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Origin not allowed." });
  assert.equal(env.DB.conversations.size, 0);
});

test("team permissions allow agents to work but reserve invitations for owners and admins", async () => {
  const env = makeEnv("agent");

  const create = await call(env, "/api/conversations", {
    method: "POST",
    body: { customer_name: "Agent-created", subject: "Agent test" }
  });
  assert.equal(create.status, 201);
  const { id } = await create.json();

  const reply = await call(env, "/api/conversations/" + id + "/messages", {
    method: "POST",
    body: { body: "Agent reply." }
  });
  assert.equal(reply.status, 201);

  const inviteAsAgent = await call(env, "/api/auth/invites", {
    method: "POST",
    body: { email: "another@example.test", role: "viewer" }
  });
  assert.equal(inviteAsAgent.status, 403);

  env.DB.role = "viewer";

  const read = await call(env, "/api/conversations");
  assert.equal(read.status, 200);

  const createAsViewer = await call(env, "/api/conversations", {
    method: "POST",
    body: { customer_name: "Viewer", subject: "Not allowed" }
  });
  assert.equal(createAsViewer.status, 403);

  const replyAsViewer = await call(env, "/api/conversations/" + id + "/messages", {
    method: "POST",
    body: { body: "This must not be saved." }
  });
  assert.equal(replyAsViewer.status, 403);

  const resolveAsViewer = await call(env, "/api/conversations/" + id, {
    method: "PATCH",
    body: { status: "resolved" }
  });
  assert.equal(resolveAsViewer.status, 403);

  const inviteAsViewer = await call(env, "/api/auth/invites", {
    method: "POST",
    body: { email: "another@example.test", role: "viewer" }
  });
  assert.equal(inviteAsViewer.status, 403);
});
