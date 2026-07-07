// Generates a parallel Prisma client whose `emailVerified` is Boolean and `Account.type` is optional
// — i.e. the POST-CUTOVER shape Better Auth reads/writes (ENG-1054). The integration harness aliases
// @formbricks/database to a shim backed by this client so BA's real user/account creation works
// against a real Postgres before the live schema is flipped. Derived from the multi-file schema in
// packages/database/schema/ so it never drifts. Output (generated/prisma-test) is gitignored. Run via
// `pnpm test:integration`.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dbDir = resolve(here, "../../../packages/database");
const srcSchemaDir = resolve(dbDir, "schema");
const testSchemaDir = resolve(dbDir, "schema-test-boolean");

rmSync(testSchemaDir, { recursive: true, force: true });
mkdirSync(testSchemaDir, { recursive: true });

let patchedAny = false;
let accountFound = false;

for (const file of readdirSync(srcSchemaDir)) {
  if (!file.endsWith(".prisma")) continue;
  let schema = readFileSync(resolve(srcSchemaDir, file), "utf8");
  const before = schema;

  // 1. separate output dir so the real client is never clobbered (path is relative to the schema dir)
  schema = schema.replace('"../generated/prisma"', '"../generated/prisma-test"');
  // 2. emailVerified Date → Boolean (what BA writes); no-ops once the live schema is flipped
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
  if (accountStart !== -1) {
    accountFound = true;
    const accountEnd = schema.indexOf("}", accountStart);
    if (accountEnd === -1) {
      throw new Error(
        "gen-boolean-client: Account model block not terminated — schema shape changed; update this script."
      );
    }
    schema =
      schema.slice(0, accountStart) +
      schema.slice(accountStart, accountEnd).replace(/\n([ \t]*)type([ \t]+)String(\s)/, "\n$1type$2String?$3") +
      schema.slice(accountEnd);
  }

  if (schema !== before) patchedAny = true;
  writeFileSync(resolve(testSchemaDir, file), schema);
}

if (!accountFound) {
  throw new Error("gen-boolean-client: Account model block not found — schema shape changed; update this script.");
}
if (!patchedAny) {
  throw new Error("gen-boolean-client: no replacements applied — schema shape changed; update this script.");
}

console.log("[gen-boolean-client] derived", testSchemaDir);

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
execFileSync(process.execPath, [prismaCli, "generate", "--schema", testSchemaDir], {
  cwd: dbDir,
  stdio: "inherit",
  env: { ...process.env, PATH: `${nodeModulesBin}${delimiter}${process.env.PATH ?? ""}` },
});
console.log("[gen-boolean-client] generated → packages/database/generated/prisma-test");
