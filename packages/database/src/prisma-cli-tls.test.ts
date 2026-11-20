import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import {
  PrismaCliTlsConfigError,
  TLS_VERIFICATION_FAILED_HINT,
  assertPrismaCliTlsSupported,
  preparePrismaCliEnvironment,
  resolvePrismaCliTls,
  runPrismaCli,
} from "./prisma-cli-tls";

const base = "postgresql://app:s3cret@db.example.com:5432/formbricks";
const caFile = "/run/certs/postgres-ca.pem";
const fileExists = (filePath: string): boolean => filePath === caFile;
const resolve = (url: string, env: NodeJS.ProcessEnv = {}) => resolvePrismaCliTls(url, env, fileExists);
const strictUrl = (query = "") => `${base}?${query ? `${query}&` : ""}sslmode=require&sslaccept=strict`;

describe("resolvePrismaCliTls", () => {
  test.each(["verify-full", "verify-ca"])("enforces sslmode=%s with sslaccept=strict", (sslmode) => {
    expect(resolve(`${base}?sslmode=${sslmode}`)).toEqual({
      databaseUrl: strictUrl(),
      verifiesServerCertificate: true,
    });
  });

  test("hands the root certificate over as a file and drops sslrootcert from the URL", () => {
    expect(resolve(`${base}?sslmode=verify-full&sslrootcert=${caFile}`)).toEqual({
      databaseUrl: strictUrl(),
      verifiesServerCertificate: true,
      rootCertFile: caFile,
    });
  });

  test.each(["", "sslmode=prefer&", "sslmode=allow&"])(
    "treats a root certificate as verifying with %s, as the app's pg does",
    (prefix) => {
      expect(resolve(`${base}?${prefix}sslrootcert=${caFile}`)).toEqual({
        databaseUrl: strictUrl(),
        verifiesServerCertificate: true,
        rootCertFile: caFile,
      });
    }
  );

  test("keeps libpq's rule for PGSSLROOTCERT, which the app's pg does not read", () => {
    expect(resolve(base, { PGSSLROOTCERT: caFile })).toEqual({
      databaseUrl: base,
      verifiesServerCertificate: false,
    });
    expect(resolve(`${base}?sslmode=prefer`, { PGSSLROOTCERT: caFile })).toEqual({
      databaseUrl: `${base}?sslmode=require`,
      verifiesServerCertificate: false,
    });
    expect(resolve(`${base}?sslmode=require`, { PGSSLROOTCERT: caFile })).toMatchObject({
      verifiesServerCertificate: true,
      rootCertFile: caFile,
    });
    // A URL sslrootcert wins over PGSSLROOTCERT and keeps the broad rule.
    expect(resolve(`${base}?sslmode=prefer&sslrootcert=${caFile}`, { PGSSLROOTCERT: "/other.pem" })).toEqual({
      databaseUrl: strictUrl(),
      verifiesServerCertificate: true,
      rootCertFile: caFile,
    });
  });

  test("does not verify a root certificate under sslmode=disable or no-verify", () => {
    const disabled = `${base}?sslmode=disable&sslrootcert=${caFile}`;
    expect(resolve(disabled)).toEqual({ databaseUrl: disabled, verifiesServerCertificate: false });
    expect(resolve(`${base}?sslmode=no-verify&sslrootcert=${caFile}`)).toEqual({
      databaseUrl: `${base}?sslmode=require&sslrootcert=${encodeURIComponent(caFile)}`,
      verifiesServerCertificate: false,
    });
  });

  test("pins the root certificate when an explicit sslaccept=strict asks for verification", () => {
    expect(resolve(`${base}?sslaccept=strict&sslrootcert=${caFile}`)).toEqual({
      databaseUrl: `${base}?sslaccept=strict&sslmode=require`,
      verifiesServerCertificate: true,
      rootCertFile: caFile,
    });
  });

  test.each([
    [
      "a libpq client certificate next to a pinned CA",
      `sslmode=verify-full&sslrootcert=${caFile}&sslcert=/c.pem`,
    ],
    ["a libpq client certificate with the OS store", "sslmode=verify-full&sslcert=/c.pem"],
    ["Prisma's CA next to a pinned CA", `sslaccept=strict&sslrootcert=${caFile}&sslcert=/c.pem`],
  ])("drops sslcert, which Prisma would trust as a root, for %s", (_name, query) => {
    expect(new URL(resolve(`${base}?${query}`).databaseUrl).searchParams.has("sslcert")).toBe(false);
  });

  test("keeps sslcert as the CA when the URL speaks Prisma's dialect without sslrootcert", () => {
    const url = `${base}?sslmode=verify-full&sslaccept=strict&sslcert=%2Fca.pem`;
    expect(resolve(url).databaseUrl).toBe(`${base}?sslmode=require&sslaccept=strict&sslcert=%2Fca.pem`);
  });

  test("treats require with a root certificate as verifying, as libpq does", () => {
    expect(resolve(`${base}?sslmode=require&sslrootcert=${caFile}`)).toMatchObject({
      databaseUrl: strictUrl(),
      rootCertFile: caFile,
    });
  });

  test.each([
    ["require", "require"],
    ["prefer", "require"],
    ["disable", "disable"],
    ["allow", "require"],
    ["no-verify", "require"],
  ])(
    "leaves sslmode=%s without a root certificate unverified, as Prisma's sslmode=%s (TLS whenever pg requires it)",
    (sslmode, prismaMode) => {
      expect(resolve(`${base}?sslmode=${sslmode}`)).toEqual({
        databaseUrl: `${base}?sslmode=${prismaMode}`,
        verifiesServerCertificate: false,
      });
    }
  );

  test.each([
    ["require", {}, `${base}?sslmode=require`, false],
    ["no-verify", {}, `${base}?sslmode=require`, false],
    ["require", { sslaccept: "strict" }, `${base}?sslaccept=strict&sslmode=require`, true],
    ["prefer", {}, `${base}?sslmode=require`, false],
    ["disable", {}, `${base}?sslmode=disable`, false],
    ["disable", { sslaccept: "strict" }, `${base}?sslaccept=strict&sslmode=require`, true],
  ])(
    "writes PGSSLMODE=%s into the URL, since Prisma reads only the URL",
    (mode, extra, expected, verifies) => {
      const query = new URLSearchParams(extra).toString();
      expect(resolve(query ? `${base}?${query}` : base, { PGSSLMODE: mode })).toEqual({
        databaseUrl: expected,
        verifiesServerCertificate: verifies,
      });
    }
  );

  test("reads a repeated parameter's last value, as pg and Prisma do", () => {
    expect(resolve(`${base}?sslmode=require&sslmode=verify-full`)).toEqual({
      databaseUrl: strictUrl(),
      verifiesServerCertificate: true,
    });
    expect(
      resolve(`${base}?sslmode=verify-full&sslaccept=strict&sslaccept=accept_invalid_certs`)
    ).toMatchObject({
      verifiesServerCertificate: false,
    });
  });

  test("rejects a root certificate path that is a directory", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "prisma-cli-tls-dir-"));
    try {
      expect(() => resolvePrismaCliTls(`${base}?sslmode=verify-full&sslrootcert=${dir}`, {})).toThrow(
        PrismaCliTlsConfigError
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("requires TLS when sslaccept asks for a checked certificate without an sslmode", () => {
    expect(resolve(`${base}?sslaccept=strict`)).toEqual({
      databaseUrl: `${base}?sslaccept=strict&sslmode=require`,
      verifiesServerCertificate: true,
    });
    expect(resolve(`${base}?sslaccept=accept_invalid_certs`)).toEqual({
      databaseUrl: `${base}?sslaccept=accept_invalid_certs&sslmode=require`,
      verifiesServerCertificate: false,
    });
  });

  test("leaves a URL without TLS settings untouched", () => {
    expect(resolve(base)).toEqual({ databaseUrl: base, verifiesServerCertificate: false });
  });

  test("keeps an explicit sslaccept=strict but still requires TLS and pins the CA", () => {
    expect(resolve(`${base}?sslmode=verify-full&sslaccept=strict&sslrootcert=${caFile}`)).toEqual({
      databaseUrl: `${base}?sslmode=require&sslaccept=strict`,
      verifiesServerCertificate: true,
      rootCertFile: caFile,
    });
  });

  test("honours sslaccept=accept_invalid_certs as an opt-out but never falls back to plaintext", () => {
    expect(
      resolve(`${base}?sslmode=verify-full&sslrootcert=/missing.pem&sslaccept=accept_invalid_certs`)
    ).toEqual({
      databaseUrl: `${base}?sslmode=require&sslaccept=accept_invalid_certs`,
      verifiesServerCertificate: false,
    });
  });

  test.each([
    ["accept_invalid_certs", false],
    ["strict", true],
  ])("requires TLS for sslmode=prefer with sslaccept=%s", (sslaccept, verifies) => {
    expect(resolve(`${base}?sslmode=prefer&sslaccept=${sslaccept}`)).toEqual({
      databaseUrl: `${base}?sslmode=require&sslaccept=${sslaccept}`,
      verifiesServerCertificate: verifies,
    });
  });

  test("keeps sslmode=disable in the URL, which wins over sslaccept in the app's pg too", () => {
    const url = `${base}?sslmode=disable&sslaccept=strict`;
    expect(resolve(url)).toEqual({ databaseUrl: url, verifiesServerCertificate: false });
  });

  test("keeps credentials, other parameters, socket hosts and the fragment", () => {
    const url =
      "postgresql://app:p%40ss@/formbricks?host=/var/run/postgresql&schema=public&sslmode=verify-full#x";
    expect(resolve(url).databaseUrl).toBe(
      "postgresql://app:p%40ss@/formbricks?host=%2Fvar%2Frun%2Fpostgresql&schema=public&sslmode=require&sslaccept=strict#x"
    );
  });

  test("falls back to PGSSLMODE and PGSSLROOTCERT when the URL does not set them", () => {
    expect(resolve(base, { PGSSLMODE: "verify-full", PGSSLROOTCERT: caFile })).toEqual({
      databaseUrl: `${base}?sslmode=require&sslaccept=strict`,
      verifiesServerCertificate: true,
      rootCertFile: caFile,
    });
  });

  test("lets the URL's sslmode win over PGSSLMODE", () => {
    const url = `${base}?sslmode=disable`;
    expect(resolve(url, { PGSSLMODE: "verify-full" }).databaseUrl).toBe(url);
  });

  test("resolves a relative root certificate path against the working directory", () => {
    const relative = "certs/ca.pem";
    const absolute = path.resolve(relative);
    const result = resolvePrismaCliTls(
      `${base}?sslmode=verify-full&sslrootcert=${relative}`,
      {},
      (filePath) => filePath === absolute
    );
    expect(result.rootCertFile).toBe(absolute);
  });

  test("fails when the root certificate file is missing, without echoing the URL", () => {
    const call = () => resolve(`${base}?sslmode=verify-full&sslrootcert=/nope/ca.pem`);
    expect(call).toThrow(PrismaCliTlsConfigError);
    expect(call).toThrow('"/nope/ca.pem"');
    expect(call).not.toThrow(/s3cret/);
  });

  test("verifies sslrootcert=system against the OS store", () => {
    expect(resolve(`${base}?sslrootcert=system`)).toEqual({
      databaseUrl: strictUrl(),
      verifiesServerCertificate: true,
    });
  });

  test.each(["require", "verify-ca"])("rejects sslrootcert=system with the weaker sslmode=%s", (sslmode) => {
    expect(() => resolve(`${base}?sslmode=${sslmode}&sslrootcert=system`)).toThrow(PrismaCliTlsConfigError);
  });

  test("validates the sslmode even when sslaccept is set", () => {
    expect(() => resolve(`${base}?sslmode=bogus&sslaccept=strict`)).toThrow(PrismaCliTlsConfigError);
  });

  // root reads any file, so the permission cannot make it unreadable there.
  test.skipIf(process.getuid?.() === 0)(
    "rejects an unreadable root certificate before any migration runs",
    async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "prisma-cli-tls-unreadable-"));
      const ca = path.join(dir, "ca.pem");
      await fs.writeFile(ca, "pem");
      await fs.chmod(ca, 0o000);
      try {
        expect(() =>
          assertPrismaCliTlsSupported(`${base}?sslmode=verify-full&sslrootcert=${ca}`, {})
        ).toThrow(PrismaCliTlsConfigError);
        expect(() => assertPrismaCliTlsSupported(`${base}?sslmode=require`, { PGSSLROOTCERT: ca })).toThrow(
          PrismaCliTlsConfigError
        );
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    }
  );

  test("assertPrismaCliTlsSupported throws only for settings the CLI cannot honour", () => {
    expect(() => assertPrismaCliTlsSupported(`${base}?sslmode=verify-full`, {})).not.toThrow();
    expect(() =>
      assertPrismaCliTlsSupported(`${base}?sslmode=verify-full&sslrootcert=/nope.pem`, {})
    ).toThrow(PrismaCliTlsConfigError);
  });

  test("rejects an sslmode Prisma would silently downgrade, without echoing the URL", () => {
    const call = () => resolve(`${base}?sslmode=VERIFY-FULL`);
    expect(call).toThrow(PrismaCliTlsConfigError);
    expect(call).not.toThrow(/s3cret/);
  });
});

describe("preparePrismaCliEnvironment", () => {
  test("pins the CLI to a private copy of the root certificate and an empty certificate directory", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "prisma-cli-tls-test-"));
    const ca = path.join(dir, "ca.pem");
    await fs.writeFile(ca, "pem");

    try {
      const prepared = await preparePrismaCliEnvironment(`${base}?sslmode=verify-full&sslrootcert=${ca}`, {
        KEEP: "1",
      });
      const { SSL_CERT_FILE: certFile, SSL_CERT_DIR: certDir } = prepared.env;

      expect(prepared.verifiesServerCertificate).toBe(true);
      expect(prepared.env).toMatchObject({ KEEP: "1", DATABASE_URL: strictUrl() });
      expect(certFile).not.toBe(ca);
      // The pinned copy survives the original being removed before the CLI reads it.
      await fs.rm(ca);
      expect(await fs.readFile(certFile!, "utf8")).toBe("pem");
      expect(await fs.readdir(certDir!)).toEqual([]);

      await prepared.cleanup();
      await prepared.cleanup();
      await expect(fs.access(path.dirname(certFile!))).rejects.toThrow();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  // root reads any file, so the permission cannot make it unreadable there.
  test.skipIf(process.getuid?.() === 0)("fails closed when the root certificate cannot be read", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "prisma-cli-tls-test-"));
    const ca = path.join(dir, "ca.pem");
    await fs.writeFile(ca, "pem");
    await fs.chmod(ca, 0o000);

    try {
      await expect(
        preparePrismaCliEnvironment(`${base}?sslmode=verify-full&sslrootcert=${ca}`, {})
      ).rejects.toThrow(PrismaCliTlsConfigError);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("leaves the certificate variables alone when the OS store applies", async () => {
    const prepared = await preparePrismaCliEnvironment(`${base}?sslmode=verify-full`, {
      SSL_CERT_FILE: "/operator/bundle.pem",
    });

    expect(prepared.env).toEqual({ SSL_CERT_FILE: "/operator/bundle.pem", DATABASE_URL: strictUrl() });
    await prepared.cleanup();
  });
});

describe("runPrismaCli", () => {
  let dir: string;
  let ca: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "prisma-cli-run-test-"));
    ca = path.join(dir, "ca.pem");
    await fs.writeFile(ca, "pem");
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  // A stand-in CLI that records the environment it was started with, then exits as asked.
  const stubCli = async (exitCode: number, output = ""): Promise<string> => {
    const bin = path.join(dir, "prisma");
    await fs.writeFile(
      bin,
      `#!/bin/sh\nprintf '%s\\n%s\\n%s\\n' "$DATABASE_URL" "$SSL_CERT_FILE" "$SSL_CERT_DIR" > "${dir}/env.txt"\necho "${output}" >&2\nexit ${exitCode.toString()}\n`
    );
    await fs.chmod(bin, 0o755);
    return bin;
  };
  const recordedEnv = async () => (await fs.readFile(path.join(dir, "env.txt"), "utf8")).split("\n");

  test("starts the CLI with the translated URL and pinned CA, then removes the empty CA directory", async () => {
    const bin = await stubCli(0);

    await runPrismaCli(bin, ["migrate", "deploy"], {
      cwd: dir,
      databaseUrl: `${base}?sslmode=verify-full&sslrootcert=${ca}`,
      baseEnv: {},
    });

    const [databaseUrl, certFile, certDir] = await recordedEnv();
    expect(databaseUrl).toBe(strictUrl());
    expect(certFile).toMatch(/formbricks-prisma-ca-.*ca\.pem$/);
    expect(certDir).toMatch(/formbricks-prisma-ca-.*certs$/);
    await expect(fs.access(certDir)).rejects.toThrow();
  });

  test("explains a TLS failure when the URL asked for verification", async () => {
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const bin = await stubCli(1, "Error: P1011: Error opening a TLS connection");

    await expect(
      runPrismaCli(bin, [], { cwd: dir, databaseUrl: `${base}?sslmode=verify-full`, baseEnv: {} })
    ).rejects.toThrow();
    expect(error).toHaveBeenCalledWith(TLS_VERIFICATION_FAILED_HINT);
  });

  test.each([
    ["an unverified URL", `${base}?sslmode=require`, "Error: P1011: Error opening a TLS connection"],
    ["another failure", `${base}?sslmode=verify-full`, "Error: P3009: migrate found failed migrations"],
  ])("adds no TLS hint for %s", async (_name, databaseUrl, output) => {
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const bin = await stubCli(1, output);

    await expect(runPrismaCli(bin, [], { cwd: dir, databaseUrl, baseEnv: {} })).rejects.toThrow();
    expect(error).not.toHaveBeenCalled();
  });
});
