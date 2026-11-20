import { execFile } from "node:child_process";
import { accessSync, constants as fsConstants, statSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { logger } from "@formbricks/logger";
import { joinConnectionUrl, lastParam, splitConnectionUrl } from "./connection-url";

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
//   the CLI trusts the OS store. Plain sslmode=require stays unverified, as in libpq, although the app's pg 8
//   connections verify it.
// - PGSSLMODE and PGSSLROOTCERT apply when the URL does not set the parameter, as in libpq and pg.
// - An explicit sslaccept is the operator's own Prisma setting and is kept, but a verifying sslmode still
//   becomes require so the connection cannot fall back to plaintext. A migration-only MIGRATE_DATABASE_URL
//   with sslaccept=accept_invalid_certs is the escape hatch that keeps the app's connections verified.

const REQUIRE = "require";
const VERIFY_CA = "verify-ca";
const VERIFY_FULL = "verify-full";
const NO_VERIFY = "no-verify";
const SSL_MODES = new Set([
  "disable",
  "allow",
  "prefer",
  REQUIRE,
  VERIFY_CA,
  VERIFY_FULL,
  // node-postgres' own alias for an unverified connection, which the app's runtime connections accept.
  NO_VERIFY,
]);
const SYSTEM_ROOT_CERT = "system";
const ACCEPT_INVALID_CERTS = "accept_invalid_certs";

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

// Checked before any migration runs, so an unreadable CA stops the run before a data migration can commit.
const isReadableFile = (filePath: string): boolean => {
  try {
    if (!statSync(filePath).isFile()) return false;
    accessSync(filePath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
};

const nonEmpty = (value: string | null | undefined): string | undefined =>
  value === null || value === undefined || value === "" ? undefined : value;

interface TTlsRequest {
  sslAccept: string | null;
  sslMode?: string;
  sslRootCert?: string;
  /** Whether sslrootcert came from the URL, which the app's pg reads, rather than PGSSLROOTCERT, which it does not. */
  rootCertInUrl: boolean;
}

/** Reads the URL's (or the environment's) TLS settings and rejects ones the CLI cannot honour. */
const readTlsRequest = (params: URLSearchParams, env: NodeJS.ProcessEnv): TTlsRequest => {
  const sslMode = nonEmpty(lastParam(params, "sslmode")) ?? nonEmpty(env.PGSSLMODE);
  const urlRootCert = nonEmpty(lastParam(params, "sslrootcert"));
  const sslRootCert = urlRootCert ?? nonEmpty(env.PGSSLROOTCERT);

  if (sslMode !== undefined && !SSL_MODES.has(sslMode)) {
    throw new PrismaCliTlsConfigError(
      `Unsupported sslmode "${sslMode}" in the database URL; use one of ${[...SSL_MODES].join(", ")}.`
    );
  }
  // libpq: sslrootcert=system defaults to verify-full and rejects any weaker sslmode.
  if (sslRootCert === SYSTEM_ROOT_CERT && sslMode !== undefined && sslMode !== VERIFY_FULL) {
    throw new PrismaCliTlsConfigError(
      `sslrootcert=system requires sslmode=verify-full, but the database URL sets sslmode=${sslMode}.`
    );
  }

  return {
    sslAccept: lastParam(params, "sslaccept"),
    sslMode,
    sslRootCert,
    rootCertInUrl: urlRootCert !== undefined,
  };
};

/**
 * The sslmode Prisma should get when the URL asks for no certificate check: disable stays plaintext, and
 * every other mode requires TLS. node-postgres 8, which the app's own connections use, requires TLS for
 * allow, prefer, require and no-verify alike, and Prisma's prefer would let a man-in-the-middle decline it.
 */
const toPrismaSslMode = (sslMode: string): string => (sslMode === "disable" ? "disable" : REQUIRE);

// A root certificate in the URL asks for verification under every mode that uses TLS and checks certificates:
// node-postgres 8, the app's driver, verifies against it for allow, prefer and require too. PGSSLROOTCERT, which
// pg does not read, keeps libpq's rule: it verifies only with require (and verify-ca/verify-full, or system).
const requestsVerification = ({ sslMode, sslRootCert, rootCertInUrl }: TTlsRequest): boolean => {
  if (sslMode === VERIFY_CA || sslMode === VERIFY_FULL || sslRootCert === SYSTEM_ROOT_CERT) return true;
  if (sslRootCert === undefined) return false;
  return rootCertInUrl ? sslMode !== "disable" && sslMode !== NO_VERIFY : sslMode === REQUIRE;
};

const resolveRootCertFile = (
  sslRootCert: string | undefined,
  fileExists: (filePath: string) => boolean
): string | undefined => {
  if (sslRootCert === undefined || sslRootCert === SYSTEM_ROOT_CERT) return undefined;

  const rootCertFile = path.resolve(sslRootCert);
  if (!fileExists(rootCertFile)) {
    throw new PrismaCliTlsConfigError(
      `Root certificate file "${rootCertFile}" from sslrootcert is not a readable file; the database server cannot be verified.`
    );
  }
  return rootCertFile;
};

/** Translates libpq TLS settings in `databaseUrl` into the parameters the Prisma CLI honours. */
export const resolvePrismaCliTls = (
  databaseUrl: string,
  env: NodeJS.ProcessEnv = process.env,
  fileExists: (filePath: string) => boolean = isReadableFile
): TPrismaCliTls => {
  const parts = splitConnectionUrl(databaseUrl);
  const request = readTlsRequest(parts.params, env);
  const { sslAccept } = request;
  const checksCertificate = sslAccept !== null && sslAccept !== ACCEPT_INVALID_CERTS;

  if (!requestsVerification(request)) {
    // Prisma reads only the URL's sslmode, so write in the one it should use when that differs. An
    // sslaccept in the URL means TLS (as in the app's pg connections) unless the URL itself disables it.
    const urlMode = lastParam(parts.params, "sslmode");
    const wantedMode = urlMode ?? (sslAccept === null ? request.sslMode : REQUIRE);
    if (wantedMode === undefined) {
      return { databaseUrl, verifiesServerCertificate: false };
    }
    const prismaMode = toPrismaSslMode(wantedMode);
    const verifies = checksCertificate && prismaMode === REQUIRE;
    if (prismaMode === urlMode) {
      return { databaseUrl, verifiesServerCertificate: verifies };
    }
    parts.params.set("sslmode", prismaMode);
    return { databaseUrl: joinConnectionUrl(parts), verifiesServerCertificate: verifies };
  }

  // Prisma reads verify-ca and verify-full as prefer, which falls back to plaintext when the server (or
  // an attacker) declines TLS. Every verifying request therefore becomes sslmode=require, even when the
  // operator set sslaccept and so chose how the certificate is checked.
  parts.params.set("sslmode", REQUIRE);
  // Prisma ignores sslrootcert; the certificate reaches it through SSL_CERT_FILE instead.
  parts.params.delete("sslrootcert");

  if (sslAccept === ACCEPT_INVALID_CERTS) {
    return { databaseUrl: joinConnectionUrl(parts), verifiesServerCertificate: false };
  }

  const rootCertFile = resolveRootCertFile(request.sslRootCert, fileExists);
  // Prisma adds sslcert as a trusted root, but in a libpq URL it is the client certificate. Drop it so trust
  // stays with the pinned CA or the OS store, unless the operator speaks Prisma's dialect (an explicit sslaccept
  // and no sslrootcert), where sslcert is the CA they chose.
  if (sslAccept === null || rootCertFile !== undefined) parts.params.delete("sslcert");
  // An explicit sslaccept other than accept_invalid_certs is strict to Prisma too, so keep the operator's.
  if (sslAccept === null) parts.params.set("sslaccept", "strict");

  return {
    databaseUrl: joinConnectionUrl(parts),
    verifiesServerCertificate: true,
    ...(rootCertFile !== undefined && { rootCertFile }),
  };
};

/**
 * Throws PrismaCliTlsConfigError when `databaseUrl` asks for TLS the Prisma CLI cannot be made to honour, so a
 * run can stop before any migration instead of at its first schema batch.
 */
export const assertPrismaCliTlsSupported = (
  databaseUrl: string,
  env: NodeJS.ProcessEnv = process.env
): void => {
  resolvePrismaCliTls(databaseUrl, env);
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

  // The CLI falls back to the OS store when SSL_CERT_FILE or SSL_CERT_DIR names a path that does not exist,
  // so both point into a private directory this run owns: a copy of the CA, which cannot vanish between this
  // check and the CLI reading it, and an empty directory that stops OpenSSL searching the OS one.
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "formbricks-prisma-ca-"));
  const cleanup = () => fs.rm(workDir, { recursive: true, force: true });
  const caCopy = path.join(workDir, "ca.pem");
  const emptyCertDir = path.join(workDir, "certs");
  try {
    await fs.copyFile(tls.rootCertFile, caCopy);
  } catch (err) {
    await cleanup();
    throw new PrismaCliTlsConfigError(
      `Root certificate file "${tls.rootCertFile}" from sslrootcert could not be read (${(err as NodeJS.ErrnoException).code ?? "error"}).`
    );
  }
  try {
    await fs.mkdir(emptyCertDir);
  } catch (err) {
    await cleanup();
    throw err;
  }
  env.SSL_CERT_FILE = caCopy;
  env.SSL_CERT_DIR = emptyCertDir;

  return { env, verifiesServerCertificate: true, cleanup };
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
  }: { cwd: string; databaseUrl: string; baseEnv?: NodeJS.ProcessEnv }
): Promise<void> => {
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
