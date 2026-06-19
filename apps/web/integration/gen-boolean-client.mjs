// Generates a parallel Prisma client whose `emailVerified` is Boolean and `Account.type` is optional
// — i.e. the POST-CUTOVER shape Better Auth reads/writes (ENG-1054). The integration harness aliases
// @formbricks/database to a shim backed by this client so BA's real user/account creation works
// against a real Postgres before the live schema is flipped. Derived from schema.prisma so it never
// drifts. Output (generated/prisma-test) is gitignored. Run via `pnpm test:integration`.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dbDir = resolve(here, "../../../packages/database");
const srcSchema = resolve(dbDir, "schema.prisma");
const testSchema = resolve(dbDir, "schema.test-boolean.prisma");

let schema = readFileSync(srcSchema, "utf8");

const before = schema;
// 1. separate output dir so the real client is never clobbered
schema = schema.replace('"./generated/prisma"', '"./generated/prisma-test"');
// 2. emailVerified Date → Boolean (what BA writes)
schema = schema.replace(
  'emailVerified DateTime? @map(name: "email_verified")',
  'emailVerified Boolean @default(false) @map(name: "email_verified")'
);
// 3. Account.type optional (BA creates accounts without a `type`), scoped to the Account model
schema = schema.replace(/(model Account \{[\s\S]*?\n\s*type\s+String)(\s)/, "$1?$2");

if (schema === before) {
  throw new Error("gen-boolean-client: no replacements applied — schema.prisma shape changed; update this script.");
}

writeFileSync(testSchema, schema);
console.log("[gen-boolean-client] derived", testSchema);

execSync(`pnpm -C ${dbDir} exec prisma generate --schema ${testSchema}`, { stdio: "inherit" });
console.log("[gen-boolean-client] generated → packages/database/generated/prisma-test");
