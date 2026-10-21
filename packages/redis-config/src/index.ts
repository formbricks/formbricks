import { X509Certificate } from "node:crypto";

export interface RedisTlsOptions {
  rejectUnauthorized: true;
  ca?: string[];
}

const CERTIFICATE_PATTERN = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;

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

  const certificates = caPem.match(CERTIFICATE_PATTERN);
  try {
    if (!certificates?.length || caPem.replace(CERTIFICATE_PATTERN, "").trim()) throw new Error();
    for (const certificate of certificates) {
      if (!new X509Certificate(certificate).ca) throw new Error();
    }
  } catch {
    throw new Error("REDIS_TLS_CA must contain only valid PEM CA certificates");
  }

  return { ca: certificates, rejectUnauthorized: true };
};
