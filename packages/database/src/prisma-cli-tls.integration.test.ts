import { execFile, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import tls from "node:tls";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { preparePrismaCliEnvironment } from "./prisma-cli-tls";

// Drives the real Prisma CLI, the dependency whose TLS handling prisma-cli-tls works around, against a
// server that speaks just enough of the PostgreSQL protocol to finish a TLS handshake. Linux only: that
// is where migrations run, and macOS builds of the schema engine use Secure Transport, not OpenSSL.
const execFileAsync = promisify(execFile);
const prismaBin = path.resolve(__dirname, "../../../node_modules/.bin/prisma");
const hasOpenssl = (() => {
  try {
    execFileSync("openssl", ["version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
const canRun = process.platform === "linux" && hasOpenssl && existsSync(prismaBin);

// PostgreSQL's SSLRequest: length 8, then the magic code 80877103.
const SSL_REQUEST = Buffer.from([0, 0, 0, 8, 4, 210, 22, 47]);

interface TFakeServer {
  port: number;
  handshakes: () => { attempted: number; completed: number };
  close: () => Promise<void>;
}

const startFakePostgres = async (key: string, cert: string): Promise<TFakeServer> => {
  let attempted = 0;
  let completed = 0;
  const server = net.createServer((socket) => {
    socket.once("data", (data: Buffer) => {
      if (!data.subarray(0, 8).equals(SSL_REQUEST)) {
        socket.destroy();
        return;
      }
      attempted += 1;
      socket.write("S");
      const secure = new tls.TLSSocket(socket, { isServer: true, key, cert });
      secure.once("secure", () => {
        completed += 1;
        secure.destroy();
      });
      secure.once("error", () => secure.destroy());
    });
    socket.on("error", () => socket.destroy());
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as net.AddressInfo;
  return {
    port,
    handshakes: () => ({ attempted, completed }),
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
};

/** A server that declines TLS ('N'), as an attacker would, and counts clients that carry on in plaintext. */
const startTlsDecliningServer = async () => {
  let plaintextStartups = 0;
  const server = net.createServer((socket) => {
    socket.once("data", (data: Buffer) => {
      if (!data.subarray(0, 8).equals(SSL_REQUEST)) return socket.destroy();
      socket.write("N");
      socket.once("data", () => {
        plaintextStartups += 1;
        socket.destroy();
      });
    });
    socket.on("error", () => socket.destroy());
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  return {
    port: (server.address() as net.AddressInfo).port,
    plaintextStartups: () => plaintextStartups,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};

describe.runIf(canRun)("Prisma CLI TLS verification", () => {
  let workDir: string;
  let caFile: string;
  let otherCaFile: string;
  let bundleWithCaLast: string;
  let server: TFakeServer | undefined;

  const openssl = (...args: string[]) => execFileSync("openssl", args, { cwd: workDir, stdio: "ignore" });

  beforeAll(async () => {
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), "prisma-cli-tls-engine-"));
    const rsa = ["-newkey", "rsa:2048", "-sha256", "-nodes", "-days", "1"];
    const caExt = [
      "-addext",
      "basicConstraints=critical,CA:TRUE",
      "-addext",
      "keyUsage=critical,keyCertSign",
    ];
    openssl("req", "-x509", ...rsa, "-subj", "/CN=test-ca", ...caExt, "-keyout", "ca.key", "-out", "ca.pem");
    openssl(
      "req",
      "-x509",
      ...rsa,
      "-subj",
      "/CN=other-ca",
      ...caExt,
      "-keyout",
      "o.key",
      "-out",
      "other.pem"
    );
    openssl("req", ...rsa.slice(0, 4), "-subj", "/CN=localhost", "-keyout", "server.key", "-out", "s.csr");
    await fs.writeFile(path.join(workDir, "san.ext"), "subjectAltName=DNS:localhost\n");
    openssl(
      "x509",
      "-req",
      "-sha256",
      "-days",
      "1",
      "-in",
      "s.csr",
      "-CA",
      "ca.pem",
      "-CAkey",
      "ca.key",
      "-CAcreateserial",
      "-extfile",
      "san.ext",
      "-out",
      "server.pem"
    );
    caFile = path.join(workDir, "ca.pem");
    otherCaFile = path.join(workDir, "other.pem");
    bundleWithCaLast = path.join(workDir, "bundle.pem");
    await fs.writeFile(
      bundleWithCaLast,
      `${await fs.readFile(otherCaFile, "utf8")}${await fs.readFile(caFile, "utf8")}`
    );

    // A minimal Prisma project with one pending migration, so `migrate deploy` has to connect.
    await fs.mkdir(path.join(workDir, "schema"));
    await fs.writeFile(
      path.join(workDir, "schema", "main.prisma"),
      'datasource db {\n  provider = "postgresql"\n}\n'
    );
    const migrationDir = path.join(workDir, "migrations", "20990101000000_probe");
    await fs.mkdir(migrationDir, { recursive: true });
    await fs.writeFile(path.join(migrationDir, "migration.sql"), "SELECT 1;\n");
    await fs.writeFile(path.join(workDir, "migrations", "migration_lock.toml"), 'provider = "postgresql"\n');
    await fs.writeFile(
      path.join(workDir, "prisma.config.mjs"),
      'export default { schema: "./schema", migrations: { path: "./migrations" }, datasource: { url: process.env.DATABASE_URL } };\n'
    );

    server = await startFakePostgres(
      await fs.readFile(path.join(workDir, "server.key"), "utf8"),
      await fs.readFile(path.join(workDir, "server.pem"), "utf8")
    );
  });

  afterAll(async () => {
    await server?.close();
    if (workDir) await fs.rm(workDir, { recursive: true, force: true });
  });

  /** Runs `migrate deploy` with `env` and returns the handshakes the fake server saw during it. */
  const migrate = async (env: NodeJS.ProcessEnv) => {
    if (!server) throw new Error("The fake server did not start");
    const fake = server;
    const before = fake.handshakes();
    await execFileAsync(prismaBin, ["migrate", "deploy", "--config", "prisma.config.mjs"], {
      cwd: workDir,
      env,
      timeout: 60_000,
    }).catch(() => undefined); // The fake server never logs in, so the CLI always fails after TLS.
    const after = fake.handshakes();
    return { attempted: after.attempted - before.attempted, completed: after.completed - before.completed };
  };

  const url = (query: string) => `postgresql://u:p@localhost:${(server?.port ?? 0).toString()}/db?${query}`;

  test("a raw verify-full URL lets the CLI trust an unrelated CA (the gap being closed)", async () => {
    const result = await migrate({
      ...process.env,
      DATABASE_URL: url(`sslmode=verify-full&sslrootcert=${otherCaFile}`),
    });

    // If this starts failing, Prisma honours verify-full itself: revisit prisma-cli-tls.
    expect(result.completed).toBeGreaterThan(0);
  }, 90_000);

  test("the translated URL refuses a server signed by a CA other than sslrootcert", async () => {
    const cli = await preparePrismaCliEnvironment(url(`sslmode=verify-full&sslrootcert=${otherCaFile}`));
    try {
      const result = await migrate(cli.env);

      expect(result.attempted).toBeGreaterThan(0);
      expect(result.completed).toBe(0);
    } finally {
      await cli.cleanup();
    }
  }, 90_000);

  test("a raw verify-full URL continues in plaintext when TLS is declined; the translated one never does", async () => {
    const decliner = await startTlsDecliningServer();
    const declinerUrl = (query: string) =>
      `postgresql://u:p@localhost:${decliner.port.toString()}/db?${query}`;
    const run = (env: NodeJS.ProcessEnv) =>
      execFileAsync(prismaBin, ["migrate", "deploy", "--config", "prisma.config.mjs"], {
        cwd: workDir,
        env,
        timeout: 60_000,
      }).catch(() => undefined);
    try {
      await run({ ...process.env, DATABASE_URL: declinerUrl("sslmode=verify-full&sslaccept=strict") });
      // If this starts failing, Prisma no longer reads verify-full as prefer: revisit prisma-cli-tls.
      expect(decliner.plaintextStartups()).toBeGreaterThan(0);

      const before = decliner.plaintextStartups();
      const cases: [string, NodeJS.ProcessEnv][] = [
        ["sslmode=verify-full&sslaccept=strict", {}],
        ["sslmode=verify-full", {}],
        ["sslaccept=strict", {}],
        ["sslaccept=strict", { PGSSLMODE: "require" }],
        ["", { PGSSLMODE: "require" }],
        ["sslmode=prefer", {}],
        ["sslaccept=strict", { PGSSLMODE: "disable" }],
        [`sslrootcert=${caFile}`, {}],
      ];
      for (const [query, env] of cases) {
        const cli = await preparePrismaCliEnvironment(declinerUrl(query), env);
        try {
          await run({ ...process.env, ...cli.env });
        } finally {
          await cli.cleanup();
        }
      }
      expect(decliner.plaintextStartups()).toBe(before);
    } finally {
      await decliner.close();
    }
  }, 180_000);

  test("Prisma trusts sslcert as a root; the translated URL never lets it widen the pinned CA", async () => {
    // The server is signed by caFile. Raw, Prisma's strict mode accepts it through sslcert alone.
    const raw = await migrate({
      ...process.env,
      DATABASE_URL: url(`sslmode=require&sslaccept=strict&sslcert=${caFile}`),
    });
    // If this starts failing, Prisma no longer reads sslcert as a root: revisit prisma-cli-tls.
    expect(raw.completed).toBeGreaterThan(0);

    for (const query of [
      `sslmode=verify-full&sslrootcert=${otherCaFile}&sslcert=${caFile}`,
      `sslaccept=strict&sslrootcert=${otherCaFile}&sslcert=${caFile}`,
    ]) {
      const cli = await preparePrismaCliEnvironment(url(query), {});
      try {
        const result = await migrate({ ...process.env, ...cli.env });
        expect(result.attempted).toBeGreaterThan(0);
        expect(result.completed).toBe(0);
      } finally {
        await cli.cleanup();
      }
    }
  }, 180_000);

  test("sslrootcert alone verifies against that CA", async () => {
    for (const [ca, accepted] of [
      [otherCaFile, false],
      [caFile, true],
    ] as const) {
      const cli = await preparePrismaCliEnvironment(url(`sslrootcert=${ca}`), {});
      try {
        const result = await migrate({ ...process.env, ...cli.env });
        expect(result.completed > 0).toBe(accepted);
      } finally {
        await cli.cleanup();
      }
    }
  }, 180_000);

  test("the translated URL refuses a certificate that does not match the host", async () => {
    // The certificate names localhost only, so 127.0.0.1 must fail even with the signing CA.
    const cli = await preparePrismaCliEnvironment(
      url(`sslmode=verify-ca&sslrootcert=${caFile}`).replace("@localhost:", "@127.0.0.1:")
    );
    try {
      const result = await migrate(cli.env);

      expect(result.attempted).toBeGreaterThan(0);
      expect(result.completed).toBe(0);
    } finally {
      await cli.cleanup();
    }
  }, 90_000);

  test.each([
    ["verify-full with the signing CA", () => `sslmode=verify-full&sslrootcert=${caFile}`],
    [
      "require with a bundle whose signing CA is not first",
      () => `sslmode=require&sslrootcert=${bundleWithCaLast}`,
    ],
  ])(
    "the translated URL connects with %s",
    async (_name, query) => {
      const cli = await preparePrismaCliEnvironment(url(query()));
      try {
        expect((await migrate(cli.env)).completed).toBeGreaterThan(0);
      } finally {
        await cli.cleanup();
      }
    },
    90_000
  );
});
