// Local disposable database proof, never a production command. Uses the existing migration runner.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scratch = await mkdtemp(path.join(os.tmpdir(), "formbricks-bridge-migrations-"));
const name = `formbricks-bridge-migrations-${randomUUID()}`;
const password = randomBytes(24).toString("hex");
let client;
let step = "start";
const timings = [];
try {
  execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "-d",
      "--name",
      name,
      "-p",
      "127.0.0.1::5432",
      "-e",
      "POSTGRES_USER=bridge",
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "pgvector/pgvector:pg17",
    ],
    { stdio: "ignore" }
  );
  for (let i = 0; i < 100; i++) {
    try {
      execFileSync("docker", ["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "bridge"], {
        stdio: "ignore",
      });
      break;
    } catch {
      if (i === 99) throw new Error("database readiness");
      await setTimeout(100);
    }
  }
  const port = execFileSync("docker", ["port", name, "5432/tcp"], { encoding: "utf8" })
    .trim()
    .split(":")
    .at(-1);
  const url = `postgresql://bridge:${password}@127.0.0.1:${port}/bridge`;
  client = new pg.Client({ connectionString: url });
  await client.connect();
  const migrate = async (phase) => {
    step = phase;
    const dir = path.join(scratch, phase);
    execFileSync(
      process.execPath,
      [path.join(root, "scripts/cloud-bridge/build-migration-artifact.mjs"), phase, dir],
      { cwd: root, stdio: "pipe" }
    );
    await symlink(path.join(root, "node_modules"), path.join(dir, "node_modules"));
    await symlink(
      path.join(root, "packages/database/node_modules"),
      path.join(dir, "packages/database/node_modules")
    );
    const start = performance.now();
    // Fresh-database baselining is used ONLY for v5-fixture, before any fixture data is inserted.
    // All subsequent migrations run normally and record their own successful completion.
    execFileSync(process.execPath, [path.join(dir, "packages/database/dist/scripts/apply-migrations.js")], {
      cwd: dir,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        DATABASE_URL: url,
        PGOPTIONS: "-c lock_timeout=5000 -c statement_timeout=120000",
      },
      stdio: "pipe",
      timeout: 180_000,
    });
    timings.push({ phase, milliseconds: Math.round(performance.now() - start) });
    console.log(JSON.stringify({ status: "passed", ...timings.at(-1) }));
  };
  await migrate("v5-fixture");
  step = "seed";
  await client.query(`
    INSERT INTO "Organization" (id,name,updated_at) VALUES ('bridgeorg','Fixture',now());
    INSERT INTO "Workspace" (id,name,"organizationId",updated_at) VALUES ('bridgeworkspace','Fixture','bridgeorg',now());
    INSERT INTO "User" (id,name,email,updated_at) VALUES ('bridgeuser','Fixture','fixture@example.invalid',now());
    INSERT INTO "Membership" ("userId","organizationId",role) VALUES ('bridgeuser','bridgeorg','owner');
    INSERT INTO "Survey" (id,name,"workspaceId",updated_at,variables,"hiddenFields")
      VALUES ('bridgesurvey','Fixture','bridgeworkspace',now(),
      '[{"id":"clx000000000000000000001","name":"score","type":"number","value":7}]',
      '{"enabled":true,"fieldIds":["source"]}');
    INSERT INTO "FeedbackDirectory" (id,name,"organizationId",updated_at) VALUES ('bridgedirectory','Fixture','bridgeorg',now());
    INSERT INTO "Chart" (id,name,"workspaceId","feedbackDirectoryId",type,updated_at)
      VALUES ('bridgechart','Fixture','bridgeworkspace','bridgedirectory','line',now());
  `);
  await migrate("expansion");
  step = "expansion invariants";
  assert.equal((await client.query('SELECT count(*)::integer AS n FROM "SurveyEmbeddedData"')).rows[0].n, 0);
  await client.query('SELECT "isSingleResponsePerEmailEnabled" FROM "Survey"');
  assert.equal((await client.query('SELECT type::text FROM "Chart"')).rows[0].type, "line");
  // Direct SQL from an old writer must enqueue in the same transaction; rollback must erase both.
  await client.query("BEGIN");
  await client.query(`UPDATE "Membership" SET role='member' WHERE "userId"='bridgeuser'`);
  assert.equal(
    (await client.query('SELECT "isRevocation" FROM "AuthzedProjectionOutbox"')).rows[0].isRevocation,
    true
  );
  await client.query("ROLLBACK");
  assert.equal(
    (await client.query('SELECT count(*)::integer AS n FROM "AuthzedProjectionOutbox"')).rows[0].n,
    0
  );
  await client.query(`UPDATE "Membership" SET role='member' WHERE "userId"='bridgeuser'`);
  assert.equal(
    (await client.query('SELECT count(*)::integer AS n FROM "AuthzedProjectionOutbox"')).rows[0].n,
    1
  );
  // Simulate the last v5 edit BEFORE the product-write pause/backfill.
  await client.query(`UPDATE "Survey" SET "hiddenFields"='{"enabled":true,"fieldIds":["source","latest"]}'`);
  await migrate("bridge");
  step = "backfill invariants";
  assert.deepEqual(
    (await client.query('SELECT "storageKey" FROM "SurveyEmbeddedData" ORDER BY "order"')).rows.map(
      (r) => r.storageKey
    ),
    ["clx000000000000000000001", "source", "latest"]
  );
  assert.equal(
    (
      await client.query(
        `SELECT status FROM "DataMigration" WHERE name='20260812121944_backfill_embedded_data'`
      )
    ).rows[0].status,
    "applied"
  );
  await client.query('SELECT "isSingleResponsePerEmailEnabled" FROM "Survey"');
  await migrate("final");
  step = "contraction invariants";
  assert.deepEqual((await client.query('SELECT type::text,config FROM "Chart"')).rows[0], {
    type: "area",
    config: { areaDisplay: "line" },
  });
  assert.equal(
    (
      await client.query(
        `SELECT count(*)::integer AS n FROM information_schema.columns WHERE table_name='Survey' AND column_name='isSingleResponsePerEmailEnabled'`
      )
    ).rows[0].n,
    0
  );
  assert.equal((await client.query('SELECT count(*)::integer AS n FROM "SurveyEmbeddedData"')).rows[0].n, 3);
  await client.query(`DELETE FROM "Organization" WHERE id='bridgeorg'`);
  const deletionTargets = (
    await client.query('SELECT DISTINCT "targetType" FROM "AuthzedProjectionOutbox" WHERE "isRevocation"')
  ).rows
    .map((r) => r.targetType)
    .sort();
  assert.deepEqual(deletionTargets, ["feedback_directory", "membership", "organization", "workspace"]);
  console.log(
    JSON.stringify({
      status: "passed",
      check: "release-migration-order-and-cascades",
      productionScale: false,
      imageRehearsal: false,
    })
  );
} catch (error) {
  // Only disposable fixture output; redact the random credential and URLs even on setup failures.
  const detail = String(error.stderr ?? error.message)
    .replaceAll(password, "[redacted]")
    .replace(/postgres(?:ql)?:\/\/\S+/g, "[database-url]")
    .slice(-1600);
  console.error(JSON.stringify({ status: "failed", step, detail }));
  process.exitCode = 1;
} finally {
  try {
    await client?.end();
  } finally {
    try {
      execFileSync("docker", ["rm", "-f", "-v", name], { stdio: "ignore" });
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  }
}
