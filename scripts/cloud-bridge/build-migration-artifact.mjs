// Temporary EU rc.5 release packaging only. This does not connect to or modify a database.
// The existing migration runner owns execution and records real migration completion.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = "c5c6ed5f0944f310990e98629419ee9ef602dbc1";
const target = "ac7bf6f2104e37b7e0299ddaa5f752f04b3e59a3";
const expansion = [
  "20260806000000_add_embedded_data_tables",
  "20260817000000_add_survey_is_anonymize_responses_enabled",
  "20260818120000_add_authzed_projection_outbox",
  "20260820000000_add_response_ingest_flags",
];
const backfill = "20260812121944_backfill_embedded_data";
const contraction = [
  "20260825000000_remove_is_single_response_per_email_enabled_from_survey",
  "20260826120000_eng_2612_merge_line_chart_type_into_area",
];
const phases = {
  // Empty disposable database fixture only, never a production migration artifact.
  "v5-fixture": [],
  expansion,
  // Product writes paused; keep paused until all original v5 writers have drained.
  bridge: [...expansion, backfill],
  // Only after every original v5 workload has terminated.
  final: [...expansion, backfill, ...contraction],
};
const [phase, destination] = process.argv.slice(2);
if (!Object.hasOwn(phases, phase) || !destination) {
  throw new Error("Usage: build-migration-artifact.mjs <v5-fixture|expansion|bridge|final> <new-directory>");
}
const output = path.resolve(destination);
const git = (...args) => execFileSync("git", args, { cwd: root });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const historical = git("ls-tree", "--name-only", `${source}:packages/database/migration`)
  .toString()
  .trim()
  .split("\n")
  .filter((name) => /^\d+_/.test(name));
const expectedNew = [...expansion, backfill, ...contraction].sort();
const actualNew = git(
  "diff",
  "--name-only",
  "--diff-filter=A",
  source,
  target,
  "--",
  "packages/database/migration"
)
  .toString()
  .trim()
  .split("\n")
  .filter((name) => /\/migration\.(sql|ts)$/.test(name))
  .map((name) => name.split("/")[3])
  .sort();
if (JSON.stringify(expectedNew) !== JSON.stringify(actualNew))
  throw new Error("Release migration inventory changed");
const selected = [...historical, ...phases[phase]].sort();
const manifest = [];
for (const name of selected) {
  const dir = `packages/database/migration/${name}`;
  for (const file of await readdir(path.join(root, dir))) {
    if (!/\.(sql|ts)$/.test(file) || file.endsWith(".test.ts")) continue;
    const filename = `${dir}/${file}`;
    const expected = git("show", `${target}:${filename}`);
    const actual = await readFile(path.join(root, filename));
    if (hash(actual) !== hash(expected))
      throw new Error(`Migration source differs from pinned rc.5: ${filename}`);
    if (
      file === "migration.sql" &&
      historical.includes(name) &&
      hash(git("show", `${source}:${filename}`)) !== hash(expected)
    ) {
      throw new Error(`Applied SQL history changed: ${name}`);
    }
    manifest.push({ file: filename, sha256: hash(actual) });
  }
}
// Refuse an existing directory, including a previous partial artifact. Never overwrite an artifact.
await mkdir(output);
const pkg = path.join(output, "packages/database");
await mkdir(pkg, { recursive: true });
for (const entry of ["dist", "schema", "generated", "package.json", "prisma.config.ts"]) {
  await cp(path.join(root, "packages/database", entry), path.join(pkg, entry), { recursive: true });
}
const migrationDir = path.join(pkg, "dist/migration");
for (const entry of await readdir(migrationDir, { withFileTypes: true })) {
  if (entry.isDirectory() && !selected.includes(entry.name))
    await rm(path.join(migrationDir, entry.name), { recursive: true });
}
for (const name of selected) {
  const sqlSource = manifest.find(
    (entry) => entry.file === `packages/database/migration/${name}/migration.sql`
  );
  if (
    sqlSource &&
    hash(await readFile(path.join(migrationDir, name, "migration.sql"))) !== sqlSource.sha256
  ) {
    throw new Error(`Built migration checksum differs: ${name}`);
  }
}
await writeFile(
  path.join(output, "migration-manifest.json"),
  JSON.stringify({ source, target, phase, migrations: selected, files: manifest }, null, 2) + "\n"
);
console.log(JSON.stringify({ status: "packaged", phase, migrationCount: selected.length }));
