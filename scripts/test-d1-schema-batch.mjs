import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const match = worker.match(/const SCHEMA_SQL = \`([\s\S]*?)\`;/);
assert.ok(match, "Worker SCHEMA_SQL template must exist");

const statements = match[1].split(";").map((sql) => sql.trim()).filter(Boolean);
assert.ok(statements.length >= 10, "Expected the base D1 schema statements");
assert.match(worker, /env\.DB\.batch\(statements\.map\(statement => env\.DB\.prepare\(statement\)\)\)/,
  "ensureSchema must prepare and batch the schema statements");
assert.doesNotMatch(worker, /env\.DB\.exec\(SCHEMA_SQL\)/,
  "ensureSchema must not pass the full multi-statement schema to D1 exec");

const result = spawnSync("sqlite3", [":memory:"], {
  input: statements.join(";") + ";",
  encoding: "utf8",
});
assert.equal(result.status, 0, `D1 schema SQL must execute statement-by-statement: ${result.stderr}`);
console.log(`Validated ${statements.length} runtime schema statements using SQLite and the D1 batch path.`);
