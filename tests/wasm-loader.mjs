import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export async function load(url, context, nextLoad) {
  if (url.endsWith(".wasm")) {
    const bytes = await readFile(fileURLToPath(url));
    const encoded = bytes.toString("base64");
    const source = `
      const bytes = Uint8Array.from(atob(${JSON.stringify(encoded)}), c => c.charCodeAt(0));
      const module = await WebAssembly.compile(bytes);
      export default module;
    `;
    return { format: "module", shortCircuit: true, source };
  }
  return nextLoad(url, context);
}
