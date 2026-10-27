/* eslint turbo/no-undeclared-env-vars: ["error", { "allowList": ["OPENSSL_BIN", "REDIS_SERVER_BIN", "REDIS_TLS_TEST_URL", "NODE_TLS_REJECT_UNAUTHORIZED"] }] */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createHttpsServer, get as httpsGet } from "node:https";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { rootCertificates } from "node:tls";
import { fileURLToPath } from "node:url";
import { createClient } from "redis";
import { getCacheService } from "@formbricks/cache";
import { getRedisTlsOptions } from "@formbricks/redis-config";
import { createProducerConnection, createWorkerConnection } from "../../../packages/jobs/src/connection.ts";
import { waitForRedisReady, waitForSuccessfulExit } from "./redis-tls-processes.mjs";

// All Redis writes below target a disposable loopback-only server. No deployed credentials are read.
const directory = mkdtempSync(join(tmpdir(), "formbricks-redis-tls-"));
const openssl = process.env.OPENSSL_BIN ?? "openssl";
const redisServer = process.env.REDIS_SERVER_BIN ?? "redis-server";
const caPath = join(directory, "ca.pem");
const caKeyPath = join(directory, "ca.key");
const vitest = join(dirname(createRequire(import.meta.url).resolve("vitest/package.json")), "vitest.mjs");
const run = (args) => execFileSync(openssl, args, { stdio: "pipe" });
delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
process.env.LOG_LEVEL = "fatal";
const freePort = async () => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return address.port;
};
const stop = async (child) => {
  if (!child.pid || child.exitCode !== null) return;
  const exit = once(child, "exit");
  const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
  child.kill("SIGTERM");
  try {
    await exit;
  } finally {
    clearTimeout(timer);
  }
};
const withRedis = async (certificate, exercise) => {
  const port = await freePort();
  const child = spawn(
    redisServer,
    [
      "--bind",
      "127.0.0.1",
      "--port",
      "0",
      "--tls-port",
      String(port),
      "--tls-cert-file",
      join(directory, `${certificate}.pem`),
      "--tls-key-file",
      join(directory, `${certificate}.key`),
      "--tls-ca-cert-file",
      caPath,
      "--tls-auth-clients",
      "no",
      "--requirepass",
      "local-test-password",
      "--save",
      "",
      "--appendonly",
      "no",
      "--dir",
      directory,
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  try {
    await waitForRedisReady(child);
    await exercise(`rediss://:local-test-password@127.0.0.1:${port}`);
  } finally {
    await stop(child);
  }
};
const rejectsBothClients = async (url, ca, code, wrongName) => {
  const tls = getRedisTlsOptions(url, ca);
  const node = createClient({
    url,
    socket: { tls: true, ...tls, servername: wrongName, reconnectStrategy: false, connectTimeout: 2000 },
  });
  node.on("error", () => {});
  try {
    await assert.rejects(node.connect(), (error) =>
      (Array.isArray(code) ? code : [code]).includes(error.code ?? "")
    );
  } finally {
    if (node.isOpen) node.destroy();
  }
  const errors = [];
  const base = createProducerConnection({ redisUrl: url });
  const io = base.duplicate({
    tls: { ...tls, servername: wrongName },
    lazyConnect: true,
    connectTimeout: 2000,
    retryStrategy: () => null,
  });
  base.disconnect();
  io.on("error", (error) => errors.push(error));
  try {
    await assert.rejects(io.connect());
    assert(
      errors.some((error) => (Array.isArray(code) ? code : [code]).includes(error.code ?? "")),
      `ioredis must reject with ${code}`
    );
  } finally {
    io.disconnect();
  }
};
try {
  execFileSync(redisServer, ["--version"], { stdio: "pipe" });
  run([
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "2",
    "-subj",
    "/CN=Redis TLS test CA",
    "-addext",
    "basicConstraints=critical,CA:TRUE",
    "-keyout",
    caKeyPath,
    "-out",
    caPath,
  ]);
  writeFileSync(join(directory, "index"), "");
  writeFileSync(join(directory, "serial"), "01\n");
  const config = join(directory, "openssl.cnf");
  writeFileSync(
    config,
    `[ca]\ndefault_ca=test\n[test]\ndatabase=${directory}/index\nserial=${directory}/serial\nnew_certs_dir=${directory}\ncertificate=${caPath}\nprivate_key=${caKeyPath}\ndefault_md=sha256\npolicy=policy\nunique_subject=no\n[policy]\ncommonName=supplied\n[server]\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n`
  );
  for (const certificate of ["valid", "expired"]) {
    run([
      "req",
      "-new",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-subj",
      `/CN=${certificate}`,
      "-keyout",
      join(directory, `${certificate}.key`),
      "-out",
      join(directory, `${certificate}.csr`),
    ]);
    run([
      "ca",
      "-batch",
      "-config",
      config,
      "-extensions",
      "server",
      "-notext",
      ...(certificate === "expired"
        ? ["-startdate", "20000101000000Z", "-enddate", "20000102000000Z"]
        : ["-days", "1"]),
      "-in",
      join(directory, `${certificate}.csr`),
      "-out",
      join(directory, `${certificate}.pem`),
    ]);
  }
  const ca = readFileSync(caPath, "utf8");
  await withRedis("valid", async (url) => {
    process.env.REDIS_URL = url;
    process.env.REDIS_TLS_CA = ca;
    const result = await getCacheService();
    assert(result.ok, "The production cache factory must connect with the private CA");
    const cache = result.data.getRedisClient();
    assert(cache);
    try {
      assert.equal(await cache.ping(), "PONG");
      await cache.set("tls-cache", "value", { EX: 60 });
      assert.equal(await cache.get("tls-cache"), "value");
    } finally {
      cache.destroy();
    }
    const producer = createProducerConnection({ redisUrl: url });
    const workerConnection = createWorkerConnection({ redisUrl: url });
    const blocking = workerConnection.duplicate();
    try {
      await Promise.all(
        [producer, workerConnection, blocking].map(async (connection) => {
          if (connection.status !== "ready") await once(connection, "ready");
          assert.equal(await connection.ping(), "PONG");
        })
      );
      const waiting = blocking.blpop("tls-worker-canary", 5);
      await producer.rpush("tls-worker-canary", "verified-tls");
      assert.deepEqual(await waiting, ["tls-worker-canary", "verified-tls"]);
    } finally {
      producer.disconnect();
      workerConnection.disconnect();
      blocking.disconnect();
    }
    const child = spawn(
      process.execPath,
      [vitest, "run", "modules/auth/lib/secondary-storage.redis-tls.test.ts"],
      {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        stdio: "inherit",
        env: { ...process.env, REDIS_TLS_TEST_URL: url },
      }
    );
    await waitForSuccessfulExit(child, "Authentication storage must work over verified TLS");
    const jobs = spawn(process.execPath, [vitest, "run", "src/upgrade.integration.test.ts"], {
      cwd: fileURLToPath(new URL("../../../packages/jobs/", import.meta.url)),
      stdio: "inherit",
      env: { ...process.env, ONLINE_UPGRADE_TEST_REDIS_URL: url },
    });
    await waitForSuccessfulExit(jobs, "BullMQ must process work over verified TLS");
    console.log(
      "PASS cache, authentication records/rate limits, BullMQ producer, worker and blocking connections"
    );
    const untrustedChain = [
      "SELF_SIGNED_CERT_IN_CHAIN",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    ];
    await rejectsBothClients(url, undefined, untrustedChain);
    await rejectsBothClients(url, rootCertificates[0], untrustedChain);
    await rejectsBothClients(url, ca, "ERR_TLS_CERT_ALTNAME_INVALID", "wrong.invalid");
    assert.throws(
      () => getRedisTlsOptions(url, readFileSync(join(directory, "valid.pem"), "utf8")),
      /valid PEM CA/
    );
    console.log("PASS missing CA, wrong CA, hostname mismatch and leaf-as-CA rejection");
  });
  await withRedis("expired", (url) => rejectsBothClients(url, ca, "CERT_HAS_EXPIRED"));
  console.log("PASS expired server certificate rejection in both Redis libraries");
  run([
    "req",
    "-x509",
    "-key",
    join(directory, "valid.key"),
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=IP:127.0.0.1",
    "-out",
    join(directory, "self-signed.pem"),
  ]);
  for (const [certificate, expectedCode] of [
    ["self-signed", "DEPTH_ZERO_SELF_SIGNED_CERT"],
    ["valid", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"],
  ]) {
    const https = createHttpsServer(
      {
        key: readFileSync(join(directory, "valid.key")),
        cert: readFileSync(join(directory, `${certificate}.pem`)),
      },
      (_request, response) => response.end("unexpected")
    );
    https.listen(0, "127.0.0.1");
    await once(https, "listening");
    try {
      const address = https.address();
      assert(address && typeof address !== "string");
      const url = `https://127.0.0.1:${address.port}`;
      await assert.rejects(
        new Promise((resolve, reject) => {
          const request = httpsGet(url, (response) => {
            response.resume();
            resolve(response);
          });
          request.on("error", reject);
          request.setTimeout(3000, () => request.destroy(new Error("HTTPS verification timed out")));
        }),
        { code: expectedCode }
      );
      await assert.rejects(
        fetch(url, { signal: AbortSignal.timeout(3000) }),
        (error) => error.cause?.code === expectedCode
      );
    } finally {
      await new Promise((resolve) => https.close(() => resolve()));
    }
  }
  console.log("PASS native HTTPS and fetch reject self-signed and Redis-CA-issued HTTPS certificates");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
