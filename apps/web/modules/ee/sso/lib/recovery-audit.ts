import "server-only";
import { logger } from "@formbricks/logger";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import type { TReclaimOutcome } from "./recovery-reclaim";

export const getSsoRecoveryLogger = (
  event: "sso_recovery_started" | "sso_recovery_completed" | "sso_recovery_failed"
) =>
  logger.withContext({
    event,
    name: "formbricks",
  });

export const queueSsoRecoveryAuditEvent = ({
  action,
  status,
  userId,
  email,
  provider,
  callbackUrl,
  failureReason,
  reclaimed,
  sessionsRevoked,
}: {
  action: "sso_recovery_started" | "sso_recovery_completed" | "sso_recovery_failed";
  status: "success" | "failure";
  userId: string;
  email: string;
  provider: string;
  callbackUrl?: string;
  failureReason?: string;
  reclaimed?: TReclaimOutcome;
  /** `null` means the sweep threw — deliberately not conflated with "there were none". */
  sessionsRevoked?: number | null;
}) => {
  void queueAuditEventBackground({
    action,
    targetType: "user",
    userId,
    targetId: userId,
    organizationId: UNKNOWN_DATA,
    status,
    userType: "user",
    newObject: {
      email,
      provider,
      ...(callbackUrl ? { callbackUrl } : {}),
      ...(failureReason ? { failureReason } : {}),
      // The one moment an account can change hands, so record what was taken away rather than only that
      // recovery succeeded. Marker keys in `newObject` are the house idiom (`passwordResetMarker`,
      // `twoFactorAuth: "disabled"`); `redactPII` masks listed keys and string values under names containing
      // token/secret/password/apiKey, so these counts and markers survive while `email` above is redacted.
      ...(reclaimed
        ? {
            credentialPasswordsCleared: reclaimed.credentialPasswordsCleared,
            legacyPasswordCleared: reclaimed.legacyPasswordCleared,
            twoFactorRowsRemoved: reclaimed.twoFactorRowsRemoved,
            legacyTwoFactorDisarmed: reclaimed.legacyTwoFactorDisarmed,
            // Reported separately, not summed. In this configuration access tokens are self-contained
            // JWTs that are never persisted (see the revocation block below), so the access count is
            // ~always 0 and a combined "grants" total would be the refresh count wearing a plural name —
            // unreadable for the one audience these fields exist for. Keeping both means an
            // access-token row appearing at all is itself visible, which would mean the opaque-token
            // configuration is in play.
            oauthAccessTokensRevoked: reclaimed.oauthAccessTokensRevoked,
            oauthRefreshTokensRevoked: reclaimed.oauthRefreshTokensRevoked,
            oauthConsentsRevoked: reclaimed.oauthConsentsRevoked,
            // The one credential with no expiry and no session behind it, so this is the field that
            // tells a responder the squatter's programmatic access ended with the account (ENG-2634).
            apiKeysRevoked: reclaimed.apiKeysRevoked,
            // `sessionsRevoked: 0` and "the sweep failed" are the same number but opposite incidents,
            // and this is the field a responder reads to confirm the squatter was actually kicked out.
            ...(sessionsRevoked === null ? { sessionRevocationFailed: true } : { sessionsRevoked }),
          }
        : {}),
    },
  });
};

/**
 * What `reclaimUnverifiedLocalAuthIfNeeded` actually removed, for the audit record. `null` means the
 * account was already proven and nothing was touched.
 */
