import test from "node:test";
import assert from "node:assert/strict";
import {
  createPasswordHash,
  isCurrentPasswordHash,
  verifyPassword
} from "../lib/passwords.mjs";

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

test("new password hashes use the OWASP minimum Argon2id profile", async () => {
  const first = await createPasswordHash("A strong test password 2026!");
  const second = await createPasswordHash("A strong test password 2026!");

  assert.match(first.hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.ok(isCurrentPasswordHash(first.hash));
  assert.notEqual(first.hash, second.hash);
  assert.notEqual(first.salt, second.salt);
});

test("Argon2id verifies correct passwords and rejects incorrect passwords", async () => {
  const result = await createPasswordHash("Correct horse battery staple 2026");
  assert.equal(await verifyPassword("Correct horse battery staple 2026", result.hash, result.salt), true);
  assert.equal(await verifyPassword("incorrect password", result.hash, result.salt), false);
});

test("legacy PBKDF2-HMAC-SHA256/100k hashes remain verifiable for migration", async () => {
  const password = "Existing Preview password 2026!";
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000
  }, key, 256);
  const oldHash = base64Url(new Uint8Array(bits));
  const oldSalt = base64Url(salt);

  assert.equal(isCurrentPasswordHash(oldHash), false);
  assert.equal(await verifyPassword(password, oldHash, oldSalt), true);
  assert.equal(await verifyPassword("wrong password", oldHash, oldSalt), false);
});

test("malformed or unknown password-hash schemes fail closed", async () => {
  assert.equal(await verifyPassword("password", "$argon2id$broken", "c2FsdA"), false);
  assert.equal(await verifyPassword("password", "$unknown$v=1$hash", "c2FsdA"), false);
  assert.equal(await verifyPassword("password", "", "c2FsdA"), false);
});
