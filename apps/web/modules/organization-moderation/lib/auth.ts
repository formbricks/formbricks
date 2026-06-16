import "server-only";
import { timingSafeEqual } from "node:crypto";
import { ORGANIZATION_MODERATION_SECRET } from "@/lib/constants";

type THeadersLike = Pick<Headers, "get">;

const BEARER_PREFIX = "bearer ";

const getBearerToken = (headers: THeadersLike): string | null => {
  const authorizationHeader = headers.get("authorization")?.trim();
  if (!authorizationHeader) {
    return null;
  }
  if (!authorizationHeader.toLowerCase().startsWith(BEARER_PREFIX)) {
    return null;
  }
  const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
};

/**
 * Authorizes a request against the organization moderation secret.
 *
 * Returns false (deny) when the secret is not configured at all, so the endpoint is
 * effectively disabled on instances that don't opt in. Comparison is constant-time to
 * avoid leaking the secret via timing.
 */
export const isModerationRequestAuthorized = (headers: THeadersLike): boolean => {
  const secret = ORGANIZATION_MODERATION_SECRET;
  if (!secret) {
    return false;
  }

  const token = getBearerToken(headers);
  if (!token) {
    return false;
  }

  const expected = Buffer.from(secret);
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
};
