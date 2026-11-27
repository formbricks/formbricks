import { rawQueryString, splitConnectionUrl } from "./connection-url";

// Guards that make the migrations read a database URL's TLS settings exactly as the app's node-postgres does, so
// prisma-cli-tls can translate them without a parser differential. pg reads the URL through pg-connection-string,
// which follows WHATWG URL parsing plus one quirk of its own; Prisma's url crate follows WHATWG parsing too.

/** A database URL TLS setting the Prisma CLI cannot be made to honour. Its message never holds the URL. */
export class PrismaCliTlsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrismaCliTlsConfigError";
  }
}

/** Every query parameter pg, libpq or Prisma reads as a TLS setting. */
export const TLS_PARAMS = [
  "ssl",
  "sslmode",
  "sslrootcert",
  "sslcert",
  "sslkey",
  "sslaccept",
  "sslnegotiation",
];
const TLS_PARAM_NAMES = new Set(TLS_PARAMS);

// WHATWG URL parsing trims leading and trailing C0 controls and spaces and deletes tabs and newlines anywhere, so
// "ss\tl=true" reaches pg and Prisma as ssl=true.
const isEdgeWhitespace = (code: number): boolean => code <= 0x20;
const isControlCharacter = (code: number): boolean => code <= 0x1f || code === 0x7f;

/** Trims the URL as WHATWG parsing does, and rejects control characters it would delete or keep inside it. */
export const trimConnectionUrl = (databaseUrl: string): string => {
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

// pg-connection-string's parse() re-encodes the whole URL with encodeURI when it holds a space or a malformed
// % escape, then restores only escapes of two decimal digits. A name or value escaped with a hex letter then
// reaches pg still escaped ("ssl%6Dode"), while Prisma and URLSearchParams decode it ("sslmode"). The tests check
// this against pg-connection-string itself.
const PG_REENCODE_TRIGGER = / |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i;

/** The query parameters as pg-connection-string reads them, when that can differ from URLSearchParams. */
const pgQueryParams = (databaseUrl: string): URLSearchParams | undefined => {
  // pg reads a URL that starts with "/" as a socket path with no query; Prisma does not accept that form.
  if (databaseUrl.startsWith("/") || !PG_REENCODE_TRIGGER.test(databaseUrl)) return undefined;
  let reencoded: string;
  try {
    reencoded = encodeURI(databaseUrl).replace(/%25(\d\d)/g, "%$1");
  } catch (err) {
    // encodeURI throws URIError only, for a lone surrogate, which pg's parse() cannot read either.
    if (!(err instanceof URIError)) throw err;
    throw new PrismaCliTlsConfigError("The database URL is not well-formed text; pg cannot read it.");
  }
  return splitConnectionUrl(reencoded).params;
};

const sequenceEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

/**
 * Rejects TLS parameters that pg would read differently from Prisma and URLSearchParams. `rawDatabaseUrl` is the
 * URL as pg gets it, untrimmed; `params` are the parameters the migrations read.
 */
export const assertPgReadsTlsAlike = (rawDatabaseUrl: string, params: URLSearchParams): void => {
  for (const segment of rawQueryString(rawDatabaseUrl).split("&")) {
    const rawName = segment.split("=", 1)[0];
    if (!rawName.includes("%")) continue;
    const [name] = new URLSearchParams(segment).keys();
    if (TLS_PARAM_NAMES.has(name)) {
      throw new PrismaCliTlsConfigError(
        `A TLS parameter name in the database URL is percent-encoded, which pg may not decode; write it as ${name}.`
      );
    }
  }

  const pgParams = pgQueryParams(rawDatabaseUrl);
  if (pgParams === undefined) return;
  for (const name of TLS_PARAMS) {
    if (!sequenceEqual(params.getAll(name), pgParams.getAll(name))) {
      throw new PrismaCliTlsConfigError(
        `The app's database driver reads ${name} in the database URL differently from the migrations, because ` +
          `the URL holds a space or a malformed % escape. Encode spaces as %20, and write ${name} without % escapes.`
      );
    }
  }
};
