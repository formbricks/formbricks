import { execFile } from "node:child_process";
import { accessSync, constants as fsConstants, statSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { logger } from "@formbricks/logger";
import {
  type TConnectionUrlParts,
  hasConflictingValues,
  joinConnectionUrl,
  lastParam,
  rawQueryString,
  splitConnectionUrl,
} from "./connection-url";

// The Prisma CLI's schema engine, which runs `prisma migrate deploy`, does not speak libpq's TLS settings:
// it reads only sslmode=disable|prefer|require, turns any other sslmode (verify-ca, verify-full) into
// prefer, ignores sslrootcert, ssl and sslnegotiation, and checks the server certificate only under
// sslaccept=strict. Its own CA parameter, sslcert, loads just the first certificate of a PEM bundle. Left
// alone, a DATABASE_URL that asks for verify-full (ENG-7337) or ssl=true (ENG-7464) migrates over an
// unverified connection while the app's pg connections verify it. This translates the request into the
// settings the CLI does honour, so migrations are never weaker than the app:
//
// - verify-ca, verify-full, sslrootcert=system, and a root certificate in the URL under any sslmode that uses
//   TLS become sslmode=require&sslaccept=strict. Strict always checks the host name too, so verify-ca is
//   enforced as verify-full: Prisma has no CA-only mode, and failing closed beats silently skipping the check.
// - Without an sslmode in the URL, the parameters node-postgres reads as a TLS request count as one: ssl=true|1,
//   sslrootcert, sslcert or sslkey verify (pg verifies all of them against its CA store), ssl=no-verify
//   requires TLS, and ssl=0 disables it. Any other ssl value is rejected: pg reads even ssl=false as verified
//   TLS. sslnegotiation=direct, which Prisma cannot negotiate, makes migrations verify too (pg-connection-string
//   2.14 reads it as verified TLS; older versions ignore it).
// - The root certificate reaches OpenSSL as SSL_CERT_FILE, which loads the whole bundle, with SSL_CERT_DIR
//   pointed at an empty directory so the OS store is not trusted next to it. Without one, the CLI trusts
//   the OS store. Plain sslmode=require (or prefer) stays unverified, as in libpq, although the app's pg 8
//   connections verify it.
// - PGSSLMODE and PGSSLROOTCERT apply when the URL does not set the parameter, as in libpq. pg ignores
//   PGSSLMODE once the URL holds any TLS parameter, so there PGSSLMODE may make migrations stricter but never
//   weaker: one that would is rejected.
// - An explicit sslaccept is the operator's own Prisma setting and is kept, but a verifying sslmode still
//   becomes require so the connection cannot fall back to plaintext. A migration-only MIGRATE_DATABASE_URL
//   with sslaccept=accept_invalid_certs is the escape hatch that keeps the app's connections verified; it
//   logs a warning when it turns off a check the URL asks for.
// - pg and this module must read the same TLS parameters, so an empty one, a conflicting repeated sslaccept,
//   a percent-encoded TLS parameter name, a TLS value pg would decode differently, or a control character
//   (which WHATWG URL parsing deletes) is rejected.

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

// Every query parameter pg, libpq or Prisma reads as a TLS setting.
const TLS_PARAMS = ["ssl", "sslmode", "sslrootcert", "sslcert", "sslkey", "sslaccept", "sslnegotiation"];
const TLS_PARAM_NAMES = new Set(TLS_PARAMS);
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

// pg-connection-string's parse() re-encodes the whole URL with encodeURI when it holds a space or a malformed
// % escape, then restores only escapes of two decimal digits. A name or value escaped with a hex letter then
// reaches pg still escaped ("ssl%6Dode"), while Prisma and this module decode it ("sslmode"). The tests check
// this against pg-connection-string itself.
const PG_REENCODE_TRIGGER = / |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i;

/** The query parameters as pg-connection-string reads them, when that can differ from URLSearchParams. */
const pgQueryParams = (databaseUrl: string): URLSearchParams | undefined => {
  // pg reads a URL that starts with "/" as a socket path with no query; Prisma does not accept that form.
  if (databaseUrl.startsWith("/") || !PG_REENCODE_TRIGGER.test(databaseUrl)) return undefined;
  let reencoded: string;
  try {
    reencoded = encodeURI(databaseUrl).replace(/%25(\d\d)/g, "%$1");
  } catch {
    throw new PrismaCliTlsConfigError("The database URL is not well-formed text; pg cannot read it.");
  }
  return splitConnectionUrl(reencoded).params;
};

const sameValues = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

/** Rejects TLS parameters that pg would read differently from Prisma and this module. */
const assertPgReadsTlsAlike = (databaseUrl: string, params: URLSearchParams): void => {
  for (const segment of rawQueryString(databaseUrl).split("&")) {
    const rawName = segment.split("=", 1)[0];
    if (!rawName.includes("%")) continue;
    const [name] = new URLSearchParams(segment).keys();
    if (TLS_PARAM_NAMES.has(name)) {
      throw new PrismaCliTlsConfigError(
        `A TLS parameter name in the database URL is percent-encoded, which pg may not decode; write it as ${name}.`
      );
    }
  }

  const pgParams = pgQueryParams(databaseUrl);
  if (pgParams === undefined) return;
  for (const name of TLS_PARAMS) {
    if (!sameValues(params.getAll(name), pgParams.getAll(name))) {
      throw new PrismaCliTlsConfigError(
        `The app's database driver reads ${name} in the database URL differently from the migrations, because ` +
          `the URL holds a space or a malformed % escape. Encode spaces as %20, and write ${name} without % escapes.`
      );
    }
  }
};

// WHATWG URL parsing, which pg-connection-string and Prisma's url crate both follow, trims leading and trailing C0
// controls and spaces and deletes tabs and newlines anywhere, so "ss\tl=true" reaches them as ssl=true.
const isEdgeWhitespace = (code: number): boolean => code <= 0x20;
const isControlCharacter = (code: number): boolean => code <= 0x1f || code === 0x7f;

/** Trims the URL as WHATWG parsing does, and rejects control characters it would delete or keep inside it. */
const trimUrl = (databaseUrl: string): string => {
  let start = 0;
  let end = databaseUrl.length;
  while (start < end && isEdgeWhitespace(databaseUrl.charCodeAt(start))) start += 1;
  while (end > start && isEdgeWhitespace(databaseUrl.charCodeAt(end - 1))) end -= 1;
  const trimmed = databaseUrl.slice(start, end);
  for (let index = 0; index < trimmed.length; index += 1) {
    if (isControlCharacter(trimmed.charCodeAt(index))) {
      throw new PrismaCliTlsConfigError(
        "The database URL holds a tab, newline or other control character; remove it."
      );
    }
  }
  return trimmed;
};

interface TTlsRequest {
  sslAccept: string | null;
  sslMode?: string;
  sslRootCert?: string;
  /** Whether sslrootcert came from the URL, which the app's pg reads, rather than PGSSLROOTCERT, which it does not. */
  rootCertInUrl: boolean;
}

/** Rejects TLS values neither pg nor Prisma reads the same way, so the two cannot disagree on them. */
const assertKnownTlsValues = (params: URLSearchParams, urlMode: string | undefined): void => {
  for (const name of TLS_PARAMS) {
    // libpq rejects an empty sslmode; pg reads every empty TLS value as unset, while Prisma reads some of them.
    if (params.getAll(name).includes("")) {
      throw new PrismaCliTlsConfigError(`${name} is empty in DATABASE_URL; give it a value or remove it.`);
    }
  }
  if (hasConflictingValues(params, "sslaccept")) {
    throw new PrismaCliTlsConfigError(
      "DATABASE_URL sets sslaccept more than once with different values; keep only one."
    );
  }
  if (urlMode !== undefined && !SSL_MODES.has(urlMode)) {
    throw new PrismaCliTlsConfigError(
      `Unsupported sslmode in DATABASE_URL; use one of ${[...SSL_MODES].join(", ")}.`
    );
  }
  const ssl = lastParam(params, "ssl");
  if (ssl !== null && !SSL_PARAM_MODES.has(ssl)) {
    throw new PrismaCliTlsConfigError(
      "Unsupported ssl in DATABASE_URL; use ssl=true, or better sslmode=verify-full."
    );
  }
  const negotiation = lastParam(params, "sslnegotiation");
  if (negotiation !== null && !SSL_NEGOTIATIONS.has(negotiation)) {
    throw new PrismaCliTlsConfigError("Unsupported sslnegotiation in DATABASE_URL; use postgres or direct.");
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
  if (envMode !== undefined && !SSL_MODES.has(envMode)) {
    throw new PrismaCliTlsConfigError(
      `Unsupported sslmode "${envMode}" in PGSSLMODE; use one of ${[...SSL_MODES].join(", ")}.`
    );
  }
  const urlRootCert = lastParam(params, "sslrootcert") ?? undefined;
  const sslRootCert = urlRootCert ?? nonEmpty(env.PGSSLROOTCERT);

  // libpq: sslrootcert=system defaults to verify-full and rejects any weaker sslmode.
  const configuredMode = urlMode ?? envMode;
  if (sslRootCert === SYSTEM_ROOT_CERT && configuredMode !== undefined && configuredMode !== VERIFY_FULL) {
    const source = urlMode === undefined ? "PGSSLMODE" : "DATABASE_URL";
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
  if (lastParam(params, "sslnegotiation") === "direct" && protection(merged) < 2) {
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
      `PGSSLMODE=${envMode} would make migrations weaker than the TLS that the other settings in DATABASE_URL ` +
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

/** How well a request protects the connection: 0 allows plaintext, 1 requires TLS, 2 also verifies the server. */
const protection = (request: TTlsRequest): number => {
  if (requestsVerification(request)) return 2;
  return request.sslMode === undefined || request.sslMode === DISABLE ? 0 : 1;
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
  const databaseUrl = trimUrl(rawDatabaseUrl);
  const parts = splitConnectionUrl(databaseUrl);
  assertPgReadsTlsAlike(databaseUrl, parts.params);
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
