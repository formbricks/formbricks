// Generates a parallel Prisma client whose `emailVerified` is Boolean and `Account.type` is optional
// — i.e. the POST-CUTOVER shape Better Auth reads/writes (ENG-1054). The integration harness aliases
// @formbricks/database to a shim backed by this client so BA's real user/account creation works
// against a real Postgres before the live schema is flipped. Derived from schema.prisma so it never
// drifts. Output (generated/prisma-test) is gitignored. Run via `pnpm test:integration`.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, resolve } from "node:path";
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
// 3. Account.type optional (BA creates accounts without a `type`), scoped to the Account model.
// Locate the block by index (no schema-spanning regex) and patch only its `type` field. The
// intra-line whitespace classes are `[ \t]` (never `\n`), so the match can't run across lines —
// that's what keeps it linear; a `[\s\S]*?`/`\s*` pattern backtracks super-linearly because those
// classes also match newlines. No-ops cleanly if `type` is already `String?`.
const accountStart = schema.indexOf("model Account {");
const accountEnd = accountStart === -1 ? -1 : schema.indexOf("}", accountStart);
if (accountStart === -1 || accountEnd === -1) {
  throw new Error("gen-boolean-client: Account model block not found — schema.prisma shape changed; update this script.");
}
schema =
  schema.slice(0, accountStart) +
  schema.slice(accountStart, accountEnd).replace(/\n([ \t]*)type([ \t]+)String(\s)/, "\n$1type$2String?$3") +
  schema.slice(accountEnd);

if (schema === before) {
  throw new Error("gen-boolean-client: no replacements applied — schema.prisma shape changed; update this script.");
}

writeFileSync(testSchema, schema);
console.log("[gen-boolean-client] derived", testSchema);

// Invoke the Prisma CLI directly through Node by ABSOLUTE path, rather than `pnpm exec prisma`:
// - process.execPath is a fixed, unwriteable path to the running Node binary, and the CLI path is
//   resolved from node_modules — so the command itself is never looked up via $PATH (Sonar S4036: a
//   planted `pnpm`/`prisma` on a writable $PATH entry can't be executed).
// - execFileSync (no shell) still passes every path as literal argv (CodeQL: no shell command built
//   from import.meta.url-derived values).
// Prisma spawns the schema's custom generators (e.g. prisma-json-types-generator) by bare name, which
// it resolves via $PATH, so the child still needs node_modules/.bin — the .bin dir alongside the
// resolved prisma package, a fixed project-owned directory (this is what `pnpm exec` set up before).
const require = createRequire(import.meta.url);
const prismaPkgJson = require.resolve("prisma/package.json");
const prismaPkg = JSON.parse(readFileSync(prismaPkgJson, "utf8"));
const prismaBin = typeof prismaPkg.bin === "string" ? prismaPkg.bin : prismaPkg.bin.prisma;
const prismaDir = dirname(prismaPkgJson);
const prismaCli = resolve(prismaDir, prismaBin);
const nodeModulesBin = resolve(prismaDir, "../.bin");
execFileSync(process.execPath, [prismaCli, "generate", "--schema", testSchema], {
  cwd: dbDir,
  stdio: "inherit",
  env: { ...process.env, PATH: `${nodeModulesBin}${delimiter}${process.env.PATH ?? ""}` },
});
console.log("[gen-boolean-client] generated → packages/database/generated/prisma-test");
