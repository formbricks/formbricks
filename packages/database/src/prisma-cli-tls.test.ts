import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import {
  PrismaCliTlsConfigError,
  TLS_VERIFICATION_FAILED_HINT,
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

  test("treats require with a root certificate as verifying, as libpq does", () => {
    expect(resolve(`${base}?sslmode=require&sslrootcert=${caFile}`)).toMatchObject({
      databaseUrl: strictUrl(),
      rootCertFile: caFile,
    });
  });

  test.each(["require", "prefer", "allow", "disable", "no-verify"])(
    "leaves sslmode=%s without a root certificate unverified",
    (sslmode) => {
      const url = `${base}?sslmode=${sslmode}`;
      expect(resolve(url)).toEqual({ databaseUrl: url, verifiesServerCertificate: false });
    }
  );

  test("leaves a URL without TLS settings untouched", () => {
    expect(resolve(base)).toEqual({ databaseUrl: base, verifiesServerCertificate: false });
  });

  test.each([
    ["accept_invalid_certs", false],
    ["strict", true],
  ])("respects an explicit sslaccept=%s", (sslaccept, verifies) => {
    const url = `${base}?sslmode=verify-full&sslrootcert=/missing.pem&sslaccept=${sslaccept}`;
    expect(resolve(url)).toEqual({ databaseUrl: url, verifiesServerCertificate: verifies });
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

  test("rejects an sslmode Prisma would silently downgrade, without echoing the URL", () => {
    const call = () => resolve(`${base}?sslmode=VERIFY-FULL`);
    expect(call).toThrow(PrismaCliTlsConfigError);
    expect(call).not.toThrow(/s3cret/);
  });
});

describe("preparePrismaCliEnvironment", () => {
  test("pins the CLI to the root certificate with an empty certificate directory", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "prisma-cli-tls-test-"));
    const ca = path.join(dir, "ca.pem");
    await fs.writeFile(ca, "pem");

    try {
      const prepared = await preparePrismaCliEnvironment(`${base}?sslmode=verify-full&sslrootcert=${ca}`, {
        KEEP: "1",
      });
      const certDir = prepared.env.SSL_CERT_DIR!;

      expect(prepared.verifiesServerCertificate).toBe(true);
      expect(prepared.env).toMatchObject({ KEEP: "1", DATABASE_URL: strictUrl(), SSL_CERT_FILE: ca });
      expect(await fs.readdir(certDir)).toEqual([]);

      await prepared.cleanup();
      await prepared.cleanup();
      await expect(fs.access(certDir)).rejects.toThrow();
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
    expect(certFile).toBe(ca);
    expect(certDir).toMatch(/formbricks-prisma-ca-/);
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

  test("refuses to start without a database URL", async () => {
    await expect(runPrismaCli("prisma", [], { cwd: dir, databaseUrl: undefined })).rejects.toThrow(
      "DATABASE_URL or MIGRATE_DATABASE_URL is required"
    );
  });
});
