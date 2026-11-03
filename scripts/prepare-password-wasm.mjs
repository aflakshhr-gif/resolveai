import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { resolve } from "node:path";

const directory = resolve("lib/cf-hash-wasm/wasm");
const names = ["argon2", "blake2b"];
await mkdir(directory, { recursive: true });

for (const name of names) {
  const compressed = await readFile(resolve(directory, `${name}.wasm.gz`));
  const wasm = gunzipSync(compressed);
  if (wasm[0] !== 0 || wasm[1] !== 97 || wasm[2] !== 115 || wasm[3] !== 109) {
    throw new Error(`Invalid WebAssembly binary for ${name}.`);
  }
  await writeFile(resolve(directory, `${name}.wasm`), wasm);
  console.log(`Prepared ${name}.wasm (${wasm.length} bytes)`);
}
