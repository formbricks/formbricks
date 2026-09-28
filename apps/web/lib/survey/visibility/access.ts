import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import type { TSurveyActorContext } from "./actor-context";
import type { TSurveyVisibilityGates } from "./gates";
import { getEffectiveVisibility } from "./policy";

/**
 * The `visibility` / `access` fields every v3 survey representation carries (contract §2). Explanatory
 * metadata only — never authorization truth; the backend re-checks on every mutation.
 */
export type TSurveyAccessVia = "organizationRole" | "owner" | "workspace";

export type TSurveyAccess = Readonly<{ canManageVisibility: boolean; via: TSurveyAccessVia }>;

type TSurveyAccessRow = Readonly<{
  ownerId: string | null;
  visibility: TSurveyVisibility;
  visibilityProjectedVersion: number;
  visibilityVersion: number;
}>;

/** What this caller is told the survey's visibility is: what is enforced on this request. */
export const getReportedVisibility = (
  row: TSurveyAccessRow,
  gates: TSurveyVisibilityGates
): TSurveyVisibility => (gates.ready ? getEffectiveVisibility(row) : "workspace");

/**
 * `via` is chosen lowest-privilege first: an organization manager who owns a private survey sees
 * `"owner"`, and on a workspace-visible survey everyone who can see it sees `"workspace"`.
 *
 * `canManageVisibility` mirrors `survey.change_visibility` — the owner or an organization admin — and is
 * `false` for everyone while the marker or the entitlement is off, and always for API keys (K-4). It is
 * derived rather than checked per row: a caller who can see a survey in a list already holds workspace
 * read, which is the owner arm's only other condition.
 */
export const deriveSurveyAccess = (
  row: TSurveyAccessRow,
  ctx: TSurveyActorContext,
  gates: TSurveyVisibilityGates
): TSurveyAccess => {
  if (ctx.kind === "apiKey") return { canManageVisibility: false, via: "workspace" };

  const isOwner = row.ownerId !== null && row.ownerId === ctx.userId;
  const canManageVisibility = gates.ready && gates.entitled && (isOwner || ctx.isOrganizationAdmin);

  if (getReportedVisibility(row, gates) === "workspace") return { canManageVisibility, via: "workspace" };
  return { canManageVisibility, via: isOwner ? "owner" : "organizationRole" };
};

/** `owner` on the wire: display only, no identifier (contract §2). */
export const serializeSurveyOwner = (
  ownerName: string | null | undefined
): Readonly<{ name: string }> | null => (ownerName == null ? null : { name: ownerName });
