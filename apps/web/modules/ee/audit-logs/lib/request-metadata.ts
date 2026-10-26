import "server-only";
import { headers } from "next/headers";
import { logger } from "@formbricks/logger";
import { AUDIT_LOG_GET_USER_IP } from "@/lib/constants";
import { UNTRUSTED_CLIENT_IP, getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import type { TAuditRequestMetadata } from "@/modules/ee/audit-logs/types/request-metadata";

export const UNKNOWN_AUDIT_REQUEST_METADATA: TAuditRequestMetadata = {
  ipAddress: UNKNOWN_DATA,
  userAgent: UNKNOWN_DATA,
};

// Strip controls so an arbitrary header cannot inject terminal or log control sequences.
// eslint-disable-next-line no-control-regex
const USER_AGENT_CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;

/** User agents are client-reported hints, never authenticated browser or automation identities. */
export const sanitizeAuditUserAgent = (value: string | null): string =>
  value?.replace(USER_AGENT_CONTROL_CHARACTERS, "").trim().slice(0, 1024) || UNKNOWN_DATA;

/** Snapshot only the trusted Proxy identity and User-Agent; never retain the full request headers. */
export const getAuditRequestMetadata = async (requestHeaders?: Headers): Promise<TAuditRequestMetadata> => {
  let headersList: Headers;
  try {
    headersList = requestHeaders ?? (await headers());
  } catch (err) {
    logger.warn({ err }, "Failed to read request metadata for audit logging");
    return {
      ipAddress: AUDIT_LOG_GET_USER_IP ? UNTRUSTED_CLIENT_IP : UNKNOWN_DATA,
      userAgent: UNKNOWN_DATA,
    };
  }

  let ipAddress = UNKNOWN_DATA;
  if (AUDIT_LOG_GET_USER_IP) {
    try {
      ipAddress = await getClientIpFromHeaders(headersList);
    } catch (err) {
      logger.warn({ err }, "Failed to resolve client IP for audit logging");
      ipAddress = UNTRUSTED_CLIENT_IP;
    }
  }

  return { ipAddress, userAgent: sanitizeAuditUserAgent(headersList.get("user-agent")) };
};
