import { argon2id, argon2Verify } from "hash-wasm";

const ARGON2_MEMORY_KIB = 19 * 1024;
const ARGON2_ITERATIONS = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LENGTH = 32;
const LEGACY_PBKDF2_ITERATIONS = 100_000;

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function constantTimeEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function verifyLegacyPbkdf2(password, storedHash, saltText) {
  if (typeof saltText !== "string" || !saltText || typeof storedHash !== "string") return false;
  const salt = fromBase64Url(saltText);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt,
    iterations: LEGACY_PBKDF2_ITERATIONS
  }, key, 256);
  const actual = new Uint8Array(bits);
  return constantTimeEqual(actual, fromBase64Url(storedHash));
}

/**
 * New passwords use Argon2id v=19, m=19456 KiB, t=2, p=1.
 * The encoded PHC string stores its algorithm parameters and salt.
 */
export async function createPasswordHash(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const encoded = await argon2id({
    password,
    salt: saltBytes,
    iterations: ARGON2_ITERATIONS,
    parallelism: ARGON2_PARALLELISM,
    memorySize: ARGON2_MEMORY_KIB,
    hashLength: ARGON2_HASH_LENGTH,
    outputType: "encoded"
  });
  if (typeof encoded !== "string" || !encoded.startsWith("$argon2id$v=19$")) {
    throw new Error("Argon2id returned an unexpected password-hash format.");
  }
  return { hash: encoded, salt: base64Url(saltBytes) };
}

export function isCurrentPasswordHash(hash) {
  return typeof hash === "string" &&
    hash.startsWith("$argon2id$v=19$m=19456,t=2,p=1$");
}

export async function verifyPassword(password, storedHash, legacySalt) {
  if (typeof password !== "string" || typeof storedHash !== "string" || !storedHash) return false;

  if (storedHash.startsWith("$argon2id$")) {
    try {
      return await argon2Verify({ password, hash: storedHash });
    } catch {
      return false;
    }
  }

  // Pre-Argon2 records in the existing Preview database used PBKDF2-HMAC-SHA256/100k.
  // They are verified once, then upgraded after a successful sign-in.
  if (storedHash.startsWith("$")) return false;
  try {
    return await verifyLegacyPbkdf2(password, storedHash, legacySalt);
  } catch {
    return false;
  }
}
