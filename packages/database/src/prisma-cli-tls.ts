import { execFile } from "node:child_process";
import { statSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { logger } from "@formbricks/logger";
import { joinConnectionUrl, splitConnectionUrl } from "./connection-url";

// The Prisma CLI's schema engine, which runs `prisma migrate deploy`, does not speak libpq's TLS settings:
// it reads only sslmode=disable|prefer|require, turns any other sslmode (verify-ca, verify-full) into
// prefer, ignores sslrootcert, and checks the server certificate only under sslaccept=strict. Its own CA
// parameter, sslcert, loads just the first certificate of a PEM bundle. Left alone, a DATABASE_URL that
// asks for verify-full migrates over an unverified connection while the app's pg connections verify it
// (ENG-7337). This translates the request into the settings the CLI does honour:
//
// - verify-ca, verify-full, require with a root certificate (libpq then behaves like verify-ca), and
//   sslrootcert=system become sslmode=require&sslaccept=strict. Strict always checks the host name too,
//   so verify-ca is enforced as verify-full: Prisma has no CA-only mode, and failing closed beats
//   silently skipping the check.
// - The root certificate reaches OpenSSL as SSL_CERT_FILE, which loads the whole bundle, with
//   SSL_CERT_DIR pointed at an empty directory so the OS store is not trusted next to it. Without one,
//   the CLI trusts the OS store, as the app's pg connections do.
// - PGSSLMODE and PGSSLROOTCERT apply when the URL does not set the parameter, as in libpq and pg.
// - An explicit sslaccept is the operator's own Prisma setting and is left alone. A migration-only
//   MIGRATE_DATABASE_URL with sslaccept=accept_invalid_certs is the escape hatch that keeps the app's
//   connections verified.

const SSL_MODES = new Set([
  "disable",
  "allow",
  "prefer",
  "require",
  "verify-ca",
  "verify-full",
  // node-postgres' own alias for an unverified connection, which the app's runtime connections accept.
  "no-verify",
]);
const SYSTEM_ROOT_CERT = "system";

/** A DATABASE_URL TLS setting the Prisma CLI cannot be made to honour. Its message never holds the URL. */
export class PrismaCliTlsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrismaCliTlsConfigError";
  }
}

export interface TPrismaCliTls {
  /** The URL to hand the Prisma CLI. */
  databaseUrl: string;
  /** Whether the CLI checks the server certificate with this URL. */
  verifiesServerCertificate: boolean;
  /** Absolute path of the only CA bundle the CLI may trust; undefined means the OS store. */
  rootCertFile?: string;
}

// pg and Prisma both let a repeated query parameter's last value win, so read it the same way.
const lastParam = (params: URLSearchParams, name: string): string | null => {
  const values = params.getAll(name);
  return values.length > 0 ? values[values.length - 1] : null;
};

const isFile = (filePath: string): boolean => {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
};

const nonEmpty = (value: string | null | undefined): string | undefined =>
  value === null || value === undefined || value === "" ? undefined : value;

/** Translates libpq TLS settings in `databaseUrl` into the parameters the Prisma CLI honours. */
export const resolvePrismaCliTls = (
  databaseUrl: string,
  env: NodeJS.ProcessEnv = process.env,
  fileExists: (filePath: string) => boolean = isFile
): TPrismaCliTls => {
  const parts = splitConnectionUrl(databaseUrl);
  const sslAccept = lastParam(parts.params, "sslaccept");

  if (sslAccept !== null) {
    return { databaseUrl, verifiesServerCertificate: sslAccept !== "accept_invalid_certs" };
  }

  const sslMode = nonEmpty(lastParam(parts.params, "sslmode")) ?? nonEmpty(env.PGSSLMODE);
  const sslRootCert = nonEmpty(lastParam(parts.params, "sslrootcert")) ?? nonEmpty(env.PGSSLROOTCERT);

  if (sslMode !== undefined && !SSL_MODES.has(sslMode)) {
    throw new PrismaCliTlsConfigError(
      `Unsupported sslmode "${sslMode}" in the database URL; use disable, prefer, require, verify-ca or verify-full.`
    );
  }

  const usesSystemRoots = sslRootCert === SYSTEM_ROOT_CERT;

  // libpq: sslrootcert=system defaults to verify-full and rejects any weaker sslmode.
  if (usesSystemRoots && sslMode !== undefined && sslMode !== "verify-full") {
    throw new PrismaCliTlsConfigError(
      `sslrootcert=system requires sslmode=verify-full, but the database URL sets sslmode=${sslMode}.`
    );
  }

  const verifies =
    sslMode === "verify-ca" ||
    sslMode === "verify-full" ||
    usesSystemRoots ||
    (sslMode === "require" && sslRootCert !== undefined);

  if (!verifies) {
    return { databaseUrl, verifiesServerCertificate: false };
  }

  let rootCertFile: string | undefined;
  if (sslRootCert !== undefined && !usesSystemRoots) {
    rootCertFile = path.resolve(sslRootCert);
    if (!fileExists(rootCertFile)) {
      throw new PrismaCliTlsConfigError(
        `Root certificate file "${rootCertFile}" from sslrootcert is not a readable file; the database server cannot be verified.`
      );
    }
  }

  parts.params.set("sslmode", "require");
  parts.params.set("sslaccept", "strict");
  // Prisma ignores sslrootcert; the certificate reaches it through SSL_CERT_FILE instead.
  parts.params.delete("sslrootcert");

  return {
    databaseUrl: joinConnectionUrl(parts),
    verifiesServerCertificate: true,
    ...(rootCertFile !== undefined && { rootCertFile }),
  };
};

export interface TPrismaCliEnvironment {
  env: NodeJS.ProcessEnv;
  verifiesServerCertificate: boolean;
  /** Removes what the environment needed on disk. Safe to call more than once. */
  cleanup: () => Promise<void>;
}

/** Builds the environment for a Prisma CLI child that verifies the database as `databaseUrl` asks. */
export const preparePrismaCliEnvironment = async (
  databaseUrl: string,
  baseEnv: NodeJS.ProcessEnv = process.env
): Promise<TPrismaCliEnvironment> => {
  const tls = resolvePrismaCliTls(databaseUrl, baseEnv);
  const env: NodeJS.ProcessEnv = { ...baseEnv, DATABASE_URL: tls.databaseUrl };

  if (tls.rootCertFile === undefined) {
    return { env, verifiesServerCertificate: tls.verifiesServerCertificate, cleanup: async () => {} };
  }

  // OpenSSL also searches SSL_CERT_DIR, and the CLI falls back to the OS directory when the variable
  // names a path that does not exist, so it must be a real, empty directory.
  const emptyCertDir = await fs.mkdtemp(path.join(os.tmpdir(), "formbricks-prisma-ca-"));
  env.SSL_CERT_FILE = tls.rootCertFile;
  env.SSL_CERT_DIR = emptyCertDir;

  return {
    env,
    verifiesServerCertificate: true,
    cleanup: () => fs.rm(emptyCertDir, { recursive: true, force: true }),
  };
};

const execFileAsync = promisify(execFile);

export const TLS_VERIFICATION_FAILED_HINT =
  "The migration could not verify the database server's TLS certificate. Mount the CA that signed it and point " +
  "sslrootcert in DATABASE_URL (or MIGRATE_DATABASE_URL) at it, and make sure the host name in the URL matches " +
  "the certificate. As a last resort, a MIGRATE_DATABASE_URL with sslaccept=accept_invalid_certs skips the " +
  "check for migrations only.";

// P1011 is Prisma's "Error opening a TLS connection".
const isTlsConnectionError = (err: unknown): boolean => {
  if (typeof err !== "object" || err === null) return false;
  const { stdout, stderr } = err as { stdout?: unknown; stderr?: unknown };
  return [stdout, stderr].some((output) => typeof output === "string" && output.includes("P1011"));
};

/**
 * Runs the Prisma CLI against `databaseUrl` with its TLS settings translated, so it verifies the server
 * whenever the URL asks for that. Prisma's config reads DATABASE_URL, which the child receives here
 * without it leaking into this process's environment. Rejects as `execFile` does when the CLI fails.
 */
export const runPrismaCli = async (
  prismaBin: string,
  args: string[],
  {
    cwd,
    databaseUrl,
    baseEnv = process.env,
  }: { cwd: string; databaseUrl?: string; baseEnv?: NodeJS.ProcessEnv }
): Promise<void> => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or MIGRATE_DATABASE_URL is required to run the Prisma CLI.");
  }

  const cli = await preparePrismaCliEnvironment(databaseUrl, baseEnv);
  try {
    await execFileAsync(prismaBin, args, { cwd, env: cli.env });
  } catch (err) {
    if (cli.verifiesServerCertificate && isTlsConnectionError(err)) {
      logger.error(TLS_VERIFICATION_FAILED_HINT);
    }
    throw err;
  } finally {
    await cli.cleanup();
  }
};
