import { X509Certificate } from "node:crypto";

export interface RedisTlsOptions {
  rejectUnauthorized: true;
  ca?: string[];
}

const CERTIFICATE_START = "-----BEGIN CERTIFICATE-----";
const CERTIFICATE_END = "-----END CERTIFICATE-----";

/** Redis private CAs must never change trust or verification for unrelated HTTPS clients. */
export const getRedisTlsOptions = (redisUrl: string, caPem?: string): RedisTlsOptions | undefined => {
  let protocol: string;
  try {
    protocol = new URL(redisUrl).protocol;
  } catch {
    // URL parsing errors can include credentials, so do not retain the original error.
    throw new Error("REDIS_URL must be a valid Redis URL");
  }

  if (protocol !== "redis:" && protocol !== "rediss:") {
    throw new Error("REDIS_URL must use redis:// or rediss://");
  }

  if (caPem !== undefined && protocol !== "rediss:") {
    throw new Error("REDIS_TLS_CA requires a rediss:// REDIS_URL");
  }

  if (protocol === "redis:") return undefined;

  // Explicit true also protects Redis while a deployment is retiring a global TLS bypass.
  if (caPem === undefined) return { rejectUnauthorized: true };

  let certificates: string[];
  try {
    // Literal splitting consumes each block once; repeated malformed headers must not trigger backtracking.
    const blocks = caPem.split(CERTIFICATE_END);
    if (blocks.pop()?.trim() || blocks.length === 0) throw new Error("Incomplete PEM CA bundle");
    certificates = blocks.map((block) => {
      const body = block.trim();
      if (!body.startsWith(CERTIFICATE_START) || body.includes(CERTIFICATE_START, CERTIFICATE_START.length)) {
        throw new Error("Invalid PEM certificate boundaries");
      }
      const certificate = `${body}\n${CERTIFICATE_END}`;
      if (!new X509Certificate(certificate).ca) throw new Error("Certificate is not a CA");
      return certificate;
    });
  } catch {
    throw new Error("REDIS_TLS_CA must contain only valid PEM CA certificates");
  }

  return { ca: certificates, rejectUnauthorized: true };
};
