import assert from "node:assert/strict";
import { pbkdf2, webcrypto } from "node:crypto";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const password = "ResolveAI legacy compatibility test password";
const salt = Buffer.from("00112233445566778899aabbccddeeff", "hex");
const iterations = 310000;
const expectedLength = 32;

const nodeHash = await new Promise((resolve, reject) => {
  pbkdf2(password, salt, iterations, expectedLength, "sha256", (error, key) => {
    if (error) reject(error);
    else resolve(key);
  });
});

const webKey = await webcrypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits"]
);
const webHash = Buffer.from(await webcrypto.subtle.deriveBits(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations },
  webKey,
  expectedLength * 8
));

const nobleHash = Buffer.from(await pbkdf2Async(
  sha256,
  new TextEncoder().encode(password),
  new Uint8Array(salt),
  { c: iterations, dkLen: expectedLength }
));

assert.deepEqual(nobleHash, nodeHash);
assert.deepEqual(nobleHash, webHash);
assert.equal(nobleHash.length, expectedLength);
console.log("Noble PBKDF2-SHA256 matches Node and WebCrypto for the legacy 310,000-iteration format.");
