const CERTIFICATE_ERRORS = new Set([
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "CERT_REJECTED",
  "CERT_REVOKED",
  "CERT_SIGNATURE_FAILURE",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "ERR_TLS_CERT_SIGNATURE_ALGORITHM_UNSUPPORTED",
  "INVALID_CA",
  "INVALID_PURPOSE",
  "PATH_LENGTH_EXCEEDED",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_DECRYPT_CERT_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

/** Reject permanent trust failures immediately; bound transient retries so auth calls can fail and retry. */
export const getAuthRedisReconnectDelay = (retries: number, cause: Error): number | false => {
  const code = "code" in cause ? cause.code : undefined;
  if ((typeof code === "string" && CERTIFICATE_ERRORS.has(code)) || retries >= 3) return false;
  return Math.min(50 * 2 ** retries, 500);
};
