import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, generateKeyPairSync, sign, verify } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

const atLeast = (actual, minimum) => {
  const current = actual.split(".").map(Number);
  const required = minimum.split(".").map(Number);
  for (let index = 0; index < required.length; index++) {
    if (current[index] !== required[index]) return current[index] > required[index];
  }
  return true;
};

assert.equal(process.versions.node.split(".")[0], "24", "Runtime must match .nvmrc's Node major");
assert.equal(
  process.versions.openssl.split(".").slice(0, 2).join("."),
  "3.5",
  "Recheck fixes before changing OpenSSL branches"
);
assert.ok(atLeast(process.versions.openssl, "3.5.9"), "Node must use patched OpenSSL");
assert.equal(process.versions.undici.split(".")[0], "7", "Recheck fixes before changing Undici majors");
assert.ok(atLeast(process.versions.undici, "7.29.1"), "Node's built-in fetch must use patched Undici");
assert.equal(process.versions.modules, "137", "Native addons must retain the Node 24 ABI");
assert.deepEqual(Intl.DateTimeFormat.supportedLocalesOf(["de", "es", "ja"]), ["de", "es", "ja"]);

const message = Buffer.from("Formbricks runtime smoke");
assert.deepEqual(inflateSync(deflateSync(message)), message);

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
assert.ok(verify("sha256", message, publicKey, sign("sha256", message, privateKey)));

const key = Buffer.alloc(32, 1);
const iv = Buffer.alloc(12, 2);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([cipher.update(message), cipher.final()]);
const decipher = createDecipheriv("aes-256-gcm", key, iv);
decipher.setAuthTag(cipher.getAuthTag());
assert.deepEqual(Buffer.concat([decipher.update(encrypted), decipher.final()]), message);
console.log("Runtime crypto, compression, locales and patched dependency versions verified");

if (process.argv.includes("--dependencies")) {
  const require = createRequire(join(process.cwd(), "apps/web/package.json"));

  // Minimum patched versions for every npm package in the live Inspector finding inventory.
  // Inspect nested copies too: a safe hoisted version does not fix an older transitive install.
  const minimumVersions = {
    next: "16.3.8",
    "@grpc/grpc-js": "1.14.5",
    sharp: "0.35.5",
    "ip-address": "10.7.1",
    mysql2: "3.23.1",
    "source-map-js": "1.2.2",
    "@opentelemetry/instrumentation-cassandra-driver": "0.66.0",
    "@opentelemetry/instrumentation-knex": "0.65.0",
    "@opentelemetry/instrumentation-mongoose": "0.67.0",
    "@opentelemetry/instrumentation-mysql": "0.67.0",
    "@opentelemetry/instrumentation-mysql2": "0.67.0",
    "@opentelemetry/instrumentation-oracledb": "0.46.0",
    "@opentelemetry/instrumentation-pg": "0.73.0",
    "@opentelemetry/instrumentation-tedious": "0.40.0",
  };
  for (const file of readdirSync(".", { recursive: true, withFileTypes: true })) {
    if (!file.isFile() || file.name !== "package.json") continue;
    const path = join(file.parentPath, file.name);
    if (!path.includes("node_modules/")) continue;
    const { name, version } = JSON.parse(readFileSync(path, "utf8"));
    assert.notEqual(name, "sprintf-js", `${path} must stay outside the runner`);
    const minimum =
      name === "undici"
        ? { 6: "6.28.1", 7: "7.29.1", 8: "8.10.2" }[version.split(".")[0]]
        : minimumVersions[name];
    if (name === "undici") assert.ok(minimum, `${path} uses an unverified Undici major`);
    if (minimum) assert.ok(atLeast(version, minimum), `${path} has vulnerable ${name}@${version}`);
  }

  // SQL Server is never selected by Formbricks' PostgreSQL-only Jackson configuration.
  // Fail the image build if tracing starts shipping its vulnerable dependency chain again.
  for (const name of ["mssql", "tedious", "sprintf-js"]) {
    assert.throws(
      () => require.resolve(name),
      { code: "MODULE_NOT_FOUND" },
      `${name} must stay outside the runner`
    );
  }

  const { DataSource } = require("typeorm");
  const dataSource = new DataSource({
    type: "postgres",
    url: "postgresql://smoke:smoke@127.0.0.1:5432/smoke",
  });
  assert.equal(dataSource.options.type, "postgres");
  console.log("SAML PostgreSQL driver loads without SQL Server dependencies");
}
