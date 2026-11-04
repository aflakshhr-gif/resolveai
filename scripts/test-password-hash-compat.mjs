import assert from "node:assert/strict";
import { pbkdf2, webcrypto } from "node:crypto";

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

const cryptoKey = await webcrypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits"]
);
const webCryptoHash = Buffer.from(await webcrypto.subtle.deriveBits(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations },
  cryptoKey,
  expectedLength * 8
));

assert.deepEqual(nodeHash, webCryptoHash);
assert.equal(nodeHash.length, expectedLength);
console.log("Node PBKDF2-SHA256 matches the legacy WebCrypto 310,000-iteration hash format.");
