import test from "node:test";
import assert from "node:assert/strict";
import { argon2id as cloudflareArgon2id } from "../lib/cf-hash-wasm/argon2.ts";
import { createBLAKE2b } from "../lib/cf-hash-wasm/blake2b.ts";
import { blake2b as referenceBlake2b } from "hash-wasm";
import { argon2id as referenceArgon2id } from "hash-wasm";
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

test("Cloudflare-compatible Argon2id module matches the hash-wasm reference vector", async () => {
  const salt = new Uint8Array([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
  const options = {
    password: "cross-check password",
    salt,
    iterations: 2,
    parallelism: 1,
    memorySize: 32,
    hashLength: 32,
    outputType: "encoded"
  };
  const actual = await cloudflareArgon2id({ ...options, salt: Uint8Array.from(salt) });
  const expected = await referenceArgon2id({ ...options, salt: Uint8Array.from(salt) });
  assert.equal(actual, expected);
});

test("Cloudflare-compatible BLAKE2b module matches the hash-wasm reference vector", async () => {
  const actualHasher = await createBLAKE2b(512);
  actualHasher.update("abc");
  const actual = actualHasher.digest("hex");
  const expected = await referenceBlake2b("abc", 512);
  assert.equal(actual, expected);
});
