import { V3ApiError } from "@/modules/api/lib/v3-client";

/**
 * How the visibility UI reacts to a failed `GET` / `POST .../visibility`:
 *
 * - `blocked`: 409, connections still depend on the survey; refetch and show them.
 * - `pending`: 503, a grant is stored but not yet in effect; it finishes on its own.
 * - `not_enabled`: 403, the feature is off for this organization; hide the controls.
 * - `not_allowed`: 422, the survey has no author and cannot be restricted.
 * - `other`: anything else, including the generic 403 and network failures.
 */
export type TVisibilityErrorKind = "blocked" | "pending" | "not_enabled" | "not_allowed" | "other";

const KIND_BY_CODE: Readonly<Record<string, TVisibilityErrorKind>> = {
  visibility_blocked_by_connections: "blocked",
  projection_pending: "pending",
  visibility_not_enabled: "not_enabled",
  visibility_change_not_allowed: "not_allowed",
};

// Only used when a problem body carries no code. A bare 403 stays `other`: it is also the shared
// "not authorized" answer, which must not hide the controls.
const KIND_BY_STATUS: Readonly<Record<number, TVisibilityErrorKind>> = {
  409: "blocked",
  422: "not_allowed",
  503: "pending",
};

export const classifyVisibilityError = (error: unknown): TVisibilityErrorKind => {
  if (!(error instanceof V3ApiError)) return "other";
  if (error.code) return KIND_BY_CODE[error.code] ?? "other";
  return KIND_BY_STATUS[error.status] ?? "other";
};
