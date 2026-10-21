// Proves with real TLS handshakes which CA store the runtime's Node trusts (ENG-4065).
//
// Node ships its own list of root CAs. Updating the OS CA package (Alpine's ca-certificates) only reaches
// Node if the binary was built with --openssl-use-def-ca-store; see the Dockerfile. Listing the store is
// no help here: with the OS store, tls.getCACertificates("default") returns nothing, so this connects.
//
// Run it inside the image, normally through verify-tls-image.sh:
//   node verify-tls.mjs <pki-dir>          offline, local servers; the directory comes from the wrapper
//   node verify-tls.mjs --incident-hosts   needs network; the published eMudhra chains must be rejected
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import https from "node:https";
import { createRequire } from "node:module";
import { join } from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";

const TIMEOUT_MS = 10_000;

// Only a certificate verification failure counts as a rejection. A refused connection or a timeout means
// the check itself is broken, and must not pass as "the chain was rejected".
const VERIFY_FAILURES = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_GET_ISSUER_CERT",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "CERT_UNTRUSTED",
  // What a blocked or revoked chain returns, as in Node's upstream blocklist for these intermediates.
  "CERT_REVOKED",
]);

const failure = (error) =>
  VERIFY_FAILURES.has(error?.code) ? `rejected:${error.code}` : `error:${error?.code ?? error?.message}`;

// The app's webhook dispatcher is an undici Agent. The package is only there when the image ships it, in
// the runtime root or next to the web app, so a missing one is reported as "skipped" rather than failing.
const loadUndici = () => {
  for (const base of [process.cwd(), join(process.cwd(), "apps/web")]) {
    try {
      return createRequire(join(base, "verify-tls.cjs"))("undici");
    } catch {
      // Try the next location.
    }
  }
  return undefined;
};

const clients = {
  tls: ({ host, port }) =>
    new Promise((resolve) => {
      const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: true }, () => {
        socket.destroy();
        resolve("accepted");
      });
      socket.setTimeout(TIMEOUT_MS, () => {
        socket.destroy();
        resolve("error:timeout");
      });
      socket.on("error", (error) => resolve(failure(error)));
    }),
  https: ({ host, port }) =>
    new Promise((resolve) => {
      const request = https.get(
        { host, port, servername: host, path: "/", timeout: TIMEOUT_MS },
        (response) => {
          response.resume();
          resolve("accepted");
        }
      );
      request.on("timeout", () => {
        request.destroy();
        resolve("error:timeout");
      });
      request.on("error", (error) => resolve(failure(error)));
    }),
  fetch: async ({ host, port }) => {
    try {
      await fetch(`https://${host}:${port}/`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      return "accepted";
    } catch (error) {
      return failure(error.cause ?? error);
    }
  },
  "undici Agent": async ({ host, port }) => {
    const undici = loadUndici();
    if (!undici) return "skipped";
    const agent = new undici.Agent();
    try {
      await undici.fetch(`https://${host}:${port}/`, {
        dispatcher: agent,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      return "accepted";
    } catch (error) {
      return failure(error.cause ?? error);
    } finally {
      await agent.close();
    }
  },
};

const connectAll = async (target) =>
  Object.fromEntries(
    await Promise.all(Object.entries(clients).map(async ([name, run]) => [name, await run(target)]))
  );

const expectOutcomes = (label, outcomes, expected) => {
  for (const [client, outcome] of Object.entries(outcomes)) {
    if (outcome === "skipped") continue;
    assert.ok(outcome.startsWith(expected), `${label} via ${client}: expected ${expected}, got ${outcome}`);
  }
};

const here = fileURLToPath(import.meta.url);

// Child process: serve a leaf (plus its intermediate) and a self-signed certificate, then connect to both
// the way the app does and report what the default store decided.
const runChild = async (pkiDir) => {
  const read = (name) => readFileSync(join(pkiDir, name));
  const listen = (cert, key) =>
    new Promise((resolve) => {
      const server = https.createServer({ cert, key }, (_request, response) => response.end("ok"));
      server.listen(0, "localhost", () => resolve(server));
    });
  const chained = await listen(read("chain.pem"), read("leaf.key"));
  const selfSigned = await listen(read("self.pem"), read("self.key"));
  const results = {
    chained: await connectAll({ host: "localhost", port: chained.address().port }),
    selfSigned: await connectAll({ host: "localhost", port: selfSigned.address().port }),
  };
  console.log(JSON.stringify(results));
  process.exit(0);
};

const runScenario = (pkiDir, env) => {
  const child = spawnSync(process.execPath, [here, "--child", pkiDir], {
    // A clean environment: an inherited SSL_CERT_*, NODE_EXTRA_CA_CERTS or NODE_OPTIONS would change the result.
    env: { PATH: process.env.PATH, ...env },
    encoding: "utf8",
    timeout: 60_000,
  });
  assert.equal(child.status, 0, `TLS probe failed to run: ${child.stderr || child.error}`);
  return JSON.parse(child.stdout.trim().split("\n").at(-1));
};

const runOffline = (pkiDir) => {
  const root = join(pkiDir, "root.pem");
  const scenarios = [
    {
      name: "the OS CA store trusts the test root",
      env: { SSL_CERT_FILE: root },
      expected: { chained: "accepted", selfSigned: "rejected" },
    },
    {
      // Deployments set NODE_OPTIONS for the heap. That must not switch the CA store back.
      name: "the same with a deployment's own NODE_OPTIONS",
      env: { SSL_CERT_FILE: root, NODE_OPTIONS: "--max_old_space_size=1024" },
      expected: { chained: "accepted", selfSigned: "rejected" },
    },
    {
      // Without this control the test would also pass for a Node that trusts everything.
      name: "the OS CA store does not hold the test root",
      env: {},
      expected: { chained: "rejected", selfSigned: "rejected" },
    },
  ];
  for (const { name, env, expected } of scenarios) {
    const results = runScenario(pkiDir, env);
    for (const [target, outcomes] of Object.entries(results)) {
      expectOutcomes(`${name}, ${target}`, outcomes, expected[target]);
    }
    const used = Object.values(results.chained).filter((outcome) => outcome !== "skipped").length;
    console.log(`ok - ${name} (${used} clients per target)`);
  }
};

// Every host the incident page publishes: DV/OV/EV x G3B/G3C, chaining to the emSign root or to AAA.
const INCIDENT_HOSTS = ["dv", "ov", "ev"].flatMap((type) =>
  ["g3b", "g3c"].flatMap((generation) => [
    `${type}-${generation}-emudhra.we-have-a-problem.com`,
    `${type}-${generation}-aaa-emudhra.we-have-a-problem.com`,
  ])
);

const runIncidentHosts = async () => {
  console.log(`node ${process.version}, openssl ${process.versions.openssl}`);
  const targets = [
    ...INCIDENT_HOSTS.map((host) => ({ host, expected: "rejected" })),
    // Control: a valid public chain must still verify, or "everything is rejected" would pass.
    { host: "nodejs.org", expected: "accepted" },
  ];
  const results = await Promise.all(
    targets.map(async ({ host, expected }) => ({
      host,
      expected,
      outcomes: await connectAll({ host, port: 443 }),
    }))
  );
  const failures = [];
  for (const { host, expected, outcomes } of results) {
    console.log(
      `${host.padEnd(44)} ${Object.entries(outcomes)
        .map(([client, outcome]) => `${client}=${outcome}`)
        .join(" ")}`
    );
    try {
      expectOutcomes(host, outcomes, expected);
    } catch (error) {
      failures.push(error.message);
    }
  }
  assert.equal(failures.length, 0, `Unexpected TLS verification results:\n  ${failures.join("\n  ")}`);
  console.log(`ok - ${INCIDENT_HOSTS.length} published eMudhra chains rejected, valid public HTTPS accepted`);
};

try {
  const [mode, pkiDir] = process.argv.slice(2);
  if (mode === "--child") await runChild(pkiDir);
  else if (mode === "--incident-hosts") await runIncidentHosts();
  else {
    assert.ok(mode, "Usage: verify-tls.mjs <pki-dir> | --incident-hosts");
    runOffline(mode);
  }
} catch (error) {
  console.error(`TLS verification failed: ${error.message}`);
  process.exitCode = 1;
}
