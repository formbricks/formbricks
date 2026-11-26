import { V3ApiError, getV3ApiErrorReason } from "@/modules/api/lib/v3-client";

/** The screens a refused invite acceptance can leave behind. */
export type TInviteRefusalState = "alreadyMember" | "expired" | "notFound";

/**
 * The screen a refused invite acceptance leaves behind, or `null` for a failure the pending screen reports
 * itself (no answer, a server fault, a refusal it has no screen for).
 */
export const getInviteRefusalState = (error: unknown): TInviteRefusalState | null => {
  if (!(error instanceof V3ApiError)) return null;
  if (error.status === 409) return "alreadyMember";
  if (error.status === 422 && getV3ApiErrorReason(error, "") === "invite_expired") return "expired";
  if (error.status === 403) return "notFound";
  return null;
};
