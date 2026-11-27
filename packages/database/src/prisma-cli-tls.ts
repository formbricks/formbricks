import { execFile } from "node:child_process";
import { accessSync, constants as fsConstants, statSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { logger } from "@formbricks/logger";
import {
  SSLACCEPT_CONFLICT_MESSAGE,
  type TConnectionUrlParts,
  hasConflictingValues,
  joinConnectionUrl,
  lastParam,
  splitConnectionUrl,
} from "./connection-url";
import {
  PrismaCliTlsConfigError,
  TLS_PARAMS,
  assertPgReadsTlsAlike,
  trimConnectionUrl,
} from "./tls-url-guards";

export { PrismaCliTlsConfigError } from "./tls-url-guards";

// The Prisma CLI's schema engine, which runs `prisma migrate deploy`, reads only sslmode=disable|prefer|require
// (verify-ca and verify-full become prefer), sslaccept (it checks certificates only under strict) and sslcert
// (an extra trusted root, first PEM only). Left alone, a URL with verify-full (ENG-7337) or ssl=true (ENG-7464)
// migrates unverified while the app's pg verifies. This translates the URL so migrations are never weaker:
//
// - verify-ca, verify-full, sslrootcert=system, and a URL sslrootcert under any sslmode that uses TLS become
//   sslmode=require&sslaccept=strict, which also checks the host name: Prisma has no CA-only mode.
// - Without a URL sslmode, what pg reads as a TLS request counts: ssl=true|1, sslrootcert, sslcert or sslkey
//   verify, ssl=no-verify requires TLS, ssl=0 disables it, and other ssl values (pg reads even ssl=false as
//   verified TLS) are rejected. sslnegotiation=direct, which Prisma cannot negotiate, raises the floor to verify.
// - The root certificate reaches OpenSSL as SSL_CERT_FILE (the whole bundle) with an empty SSL_CERT_DIR;
//   without one the CLI trusts the OS store. Plain sslmode=require or prefer stays unverified, as in libpq.
// - PGSSLMODE and PGSSLROOTCERT apply when the URL does not set the parameter, as in libpq. pg ignores
//   PGSSLMODE once the URL has TLS settings, so there it may make migrations stricter, and one that would
//   weaken them is rejected.
// - An explicit sslaccept is kept, but a verifying sslmode still becomes require, so nothing falls back to
//   plaintext. sslaccept=accept_invalid_certs in a migration-only MIGRATE_DATABASE_URL is the escape hatch; it
//   logs a warning when it turns off a check the URL asks for.
// - Empty TLS settings, a conflicting repeated sslaccept, and anything tls-url-guards finds pg would read
//   differently are rejected.

const DISABLE = "disable";
const REQUIRE = "require";
const VERIFY_CA = "verify-ca";
const VERIFY_FULL = "verify-full";
const NO_VERIFY = "no-verify";
const SSL_MODES = new Set([
  DISABLE,
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

// node-postgres' ssl parameter, as the sslmode it amounts to. pg reads every other non-empty value as verified TLS.
const SSL_PARAM_MODES = new Map([
  ["true", VERIFY_FULL],
  ["1", VERIFY_FULL],
  [NO_VERIFY, NO_VERIFY],
  ["0", DISABLE],
]);
const SSL_NEGOTIATIONS = new Set(["postgres", "direct"]);
// Parameters with which pg verifies the server whatever ssl says: it builds an ssl object, which defaults to
// rejectUnauthorized.
const PG_VERIFYING_PARAMS = ["sslrootcert", "sslcert", "sslkey"];

export interface TPrismaCliTls {
  /** The URL to hand the Prisma CLI. */
  databaseUrl: string;
  /** Whether the CLI checks the server certificate with this URL. */
  verifiesServerCertificate: boolean;
  /** Absolute path of the only CA bundle the CLI may trust; undefined means the OS store. */
  rootCertFile?: string;
  /** Set when the URL asks for verification but sslaccept=accept_invalid_certs turns it off. */
  verificationSkipped?: true;
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

const assertKnownSslMode = (sslMode: string | undefined, source: string): void => {
  if (sslMode !== undefined && !SSL_MODES.has(sslMode)) {
    throw new PrismaCliTlsConfigError(
      `Unsupported sslmode in ${source}; use one of ${[...SSL_MODES].join(", ")}.`
    );
  }
};

/** Rejects TLS values neither pg nor Prisma reads the same way, so the two cannot disagree on them. */
const assertKnownTlsValues = (params: URLSearchParams, urlMode: string | undefined): void => {
  for (const name of TLS_PARAMS) {
    // libpq rejects an empty sslmode; pg reads every empty TLS value as unset, while Prisma reads some of them.
    if (params.getAll(name).includes("")) {
      throw new PrismaCliTlsConfigError(
        `${name} is empty in the database URL; give it a value or remove it.`
      );
    }
  }
  if (hasConflictingValues(params, "sslaccept")) {
    throw new PrismaCliTlsConfigError(SSLACCEPT_CONFLICT_MESSAGE);
  }
  assertKnownSslMode(urlMode, "the database URL");
  const ssl = lastParam(params, "ssl");
  if (ssl !== null && !SSL_PARAM_MODES.has(ssl)) {
    throw new PrismaCliTlsConfigError(
      "Unsupported ssl in the database URL; use ssl=true, or better sslmode=verify-full."
    );
  }
  const negotiation = lastParam(params, "sslnegotiation");
  if (negotiation !== null && !SSL_NEGOTIATIONS.has(negotiation)) {
    throw new PrismaCliTlsConfigError(
      "Unsupported sslnegotiation in the database URL; use postgres or direct."
    );
  }
};

/**
 * The sslmode the app's pg acts on when the URL sets no sslmode but other TLS parameters; undefined when it
 * sets none. pg then ignores PGSSLMODE.
 */
const impliedSslMode = (params: URLSearchParams): string | undefined => {
  if (PG_VERIFYING_PARAMS.some((name) => params.has(name))) return VERIFY_FULL;
  const ssl = lastParam(params, "ssl");
  return ssl === null ? undefined : SSL_PARAM_MODES.get(ssl);
};

/** Reads the URL's (or the environment's) TLS settings and rejects ones the CLI cannot honour. */
const readTlsRequest = (params: URLSearchParams, env: NodeJS.ProcessEnv): TTlsRequest => {
  const urlMode = lastParam(params, "sslmode") ?? undefined;
  assertKnownTlsValues(params, urlMode);

  const envMode = nonEmpty(env.PGSSLMODE);
  assertKnownSslMode(envMode, "PGSSLMODE");
  const urlRootCert = lastParam(params, "sslrootcert") ?? undefined;
  const sslRootCert = urlRootCert ?? nonEmpty(env.PGSSLROOTCERT);

  // libpq: sslrootcert=system defaults to verify-full and rejects any weaker sslmode.
  const configuredMode = urlMode ?? envMode;
  if (sslRootCert === SYSTEM_ROOT_CERT && configuredMode !== undefined && configuredMode !== VERIFY_FULL) {
    const source = urlMode === undefined ? "PGSSLMODE" : "the database URL";
    throw new PrismaCliTlsConfigError(
      `sslrootcert=system requires sslmode=verify-full, but ${source} sets sslmode=${configuredMode}.`
    );
  }

  const request: TTlsRequest = {
    sslAccept: lastParam(params, "sslaccept"),
    sslRootCert,
    rootCertInUrl: urlRootCert !== undefined,
  };
  if (urlMode !== undefined) return { ...request, sslMode: urlMode };

  const merged = { ...request, sslMode: mergeEnvMode(request, impliedSslMode(params), envMode) };
  // Direct negotiation starts with a TLS handshake. Prisma cannot negotiate that way, so the handshake it does
  // make must at least be verified. Whether pg reads sslnegotiation depends on its version, so this only ever
  // raises the floor and never rejects the environment's mode.
  if (lastParam(params, "sslnegotiation") === "direct" && protection(merged) < VERIFIED) {
    return { ...merged, sslMode: VERIFY_FULL };
  }
  return merged;
};

/** The sslmode from the URL's other TLS parameters and PGSSLMODE, which pg ignores once the URL has any. */
const mergeEnvMode = (
  request: TTlsRequest,
  urlImplied: string | undefined,
  envMode: string | undefined
): string | undefined => {
  if (urlImplied === undefined || envMode === undefined) return urlImplied ?? envMode;
  // PGSSLMODE may make migrations stricter than the URL, but never weaker for migrations alone.
  const fromUrl = protection({ ...request, sslMode: urlImplied });
  const fromEnv = protection({ ...request, sslMode: envMode });
  if (fromEnv < fromUrl) {
    throw new PrismaCliTlsConfigError(
      `PGSSLMODE=${envMode} would make migrations weaker than the TLS that the other settings in the database URL ` +
        "ask for; set sslmode in DATABASE_URL instead."
    );
  }
  return fromEnv > fromUrl ? envMode : urlImplied;
};

/**
 * The sslmode Prisma should get when the URL asks for no certificate check: disable stays plaintext, and
 * every other mode requires TLS. node-postgres 8, which the app's own connections use, requires TLS for
 * allow, prefer, require and no-verify alike, and Prisma's prefer would let a man-in-the-middle decline it.
 */
const toPrismaSslMode = (sslMode: string): string => (sslMode === DISABLE ? DISABLE : REQUIRE);

// A root certificate in the URL asks for verification under every mode that uses TLS and checks certificates:
// node-postgres 8, the app's driver, verifies against it for allow, prefer and require too. PGSSLROOTCERT, which
// pg does not read, keeps libpq's rule: it verifies only with require (and verify-ca/verify-full, or system).
const requestsVerification = ({ sslMode, sslRootCert, rootCertInUrl }: TTlsRequest): boolean => {
  if (sslMode === VERIFY_CA || sslMode === VERIFY_FULL || sslRootCert === SYSTEM_ROOT_CERT) return true;
  if (sslRootCert === undefined) return false;
  return rootCertInUrl ? sslMode !== DISABLE && sslMode !== NO_VERIFY : sslMode === REQUIRE;
};

// How well a request protects the connection, in increasing order.
const PLAINTEXT_ALLOWED = 0;
const TLS_REQUIRED = 1;
const VERIFIED = 2;
type TProtection = typeof PLAINTEXT_ALLOWED | typeof TLS_REQUIRED | typeof VERIFIED;

const protection = (request: TTlsRequest): TProtection => {
  if (requestsVerification(request)) return VERIFIED;
  return request.sslMode === undefined || request.sslMode === DISABLE ? PLAINTEXT_ALLOWED : TLS_REQUIRED;
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

/**
 * The URL for a request that asks for no certificate check. Prisma reads only the URL's sslmode, so this writes
 * in the one it should use when that differs. An sslaccept in the URL means TLS (as in the app's pg connections)
 * unless the URL itself disables it.
 */
const resolveUnverified = (
  databaseUrl: string,
  parts: TConnectionUrlParts,
  { sslAccept, sslMode }: TTlsRequest
): TPrismaCliTls => {
  const urlMode = lastParam(parts.params, "sslmode");
  const wantedMode = urlMode ?? (sslAccept === null ? sslMode : REQUIRE);
  // With an sslkey, sslcert is a libpq client certificate, which Prisma would add as a trusted root.
  const dropsClientCert = parts.params.has("sslcert") && parts.params.has("sslkey");
  if (dropsClientCert) parts.params.delete("sslcert");
  if (wantedMode === undefined) {
    return {
      databaseUrl: dropsClientCert ? joinConnectionUrl(parts) : databaseUrl,
      verifiesServerCertificate: false,
    };
  }
  const prismaMode = toPrismaSslMode(wantedMode);
  const sslAcceptChecksCertificate = sslAccept !== null && sslAccept !== ACCEPT_INVALID_CERTS;
  const verifies = sslAcceptChecksCertificate && prismaMode === REQUIRE;
  if (prismaMode === urlMode && !dropsClientCert) {
    return { databaseUrl, verifiesServerCertificate: verifies };
  }
  parts.params.set("sslmode", prismaMode);
  return { databaseUrl: joinConnectionUrl(parts), verifiesServerCertificate: verifies };
};

/** Translates libpq and node-postgres TLS settings in `databaseUrl` into the parameters the Prisma CLI honours. */
export const resolvePrismaCliTls = (
  rawDatabaseUrl: string,
  env: NodeJS.ProcessEnv = process.env,
  fileExists: (filePath: string) => boolean = isReadableFile
): TPrismaCliTls => {
  const databaseUrl = trimConnectionUrl(rawDatabaseUrl);
  const parts = splitConnectionUrl(databaseUrl);
  // pg reads the raw URL: a space at its edge alone switches pg-connection-string to its re-encoding path.
  assertPgReadsTlsAlike(rawDatabaseUrl, parts.params);
  const request = readTlsRequest(parts.params, env);
  const { sslAccept } = request;

  if (!requestsVerification(request)) {
    return resolveUnverified(databaseUrl, parts, request);
  }

  // Prisma reads verify-ca and verify-full as prefer, which falls back to plaintext when the server (or
  // an attacker) declines TLS. Every verifying request therefore becomes sslmode=require, even when the
  // operator set sslaccept and so chose how the certificate is checked.
  parts.params.set("sslmode", REQUIRE);
  // Prisma ignores sslrootcert; the certificate reaches it through SSL_CERT_FILE instead.
  parts.params.delete("sslrootcert");

  if (sslAccept === ACCEPT_INVALID_CERTS) {
    return {
      databaseUrl: joinConnectionUrl(parts),
      verifiesServerCertificate: false,
      verificationSkipped: true,
    };
  }

  const rootCertFile = resolveRootCertFile(request.sslRootCert, fileExists);
  // Prisma adds sslcert as a trusted root, but in a libpq URL it is the client certificate. Drop it so trust
  // stays with the pinned CA or the OS store, unless the operator speaks Prisma's dialect (an explicit sslaccept,
  // no sslrootcert and no sslkey), where sslcert is the CA they chose.
  const prismaDialect =
    sslAccept !== null && request.sslRootCert === undefined && !parts.params.has("sslkey");
  if (!prismaDialect) parts.params.delete("sslcert");
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
  /** Whether sslaccept=accept_invalid_certs turned off a check the URL asks for. */
  verificationSkipped: boolean;
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
    return {
      env,
      verifiesServerCertificate: tls.verifiesServerCertificate,
      verificationSkipped: tls.verificationSkipped === true,
      cleanup: async () => {},
    };
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

  return { env, verifiesServerCertificate: true, verificationSkipped: false, cleanup };
};

const execFileAsync = promisify(execFile);

export const TLS_VERIFICATION_FAILED_HINT =
  "The migration could not verify the database server's TLS certificate. Mount the CA that signed it and point " +
  "sslrootcert in DATABASE_URL (or MIGRATE_DATABASE_URL) at it, and make sure the host name in the URL matches " +
  "the certificate. As a last resort, a MIGRATE_DATABASE_URL with sslaccept=accept_invalid_certs skips the " +
  "check for migrations only.";

export const TLS_VERIFICATION_SKIPPED_WARNING =
  "The database TLS settings ask for a verified certificate, but sslaccept=accept_invalid_certs turns the check " +
  "off: migrations will accept any certificate. Remove sslaccept to verify them.";

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
  if (cli.verificationSkipped) logger.warn(TLS_VERIFICATION_SKIPPED_WARNING);
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
