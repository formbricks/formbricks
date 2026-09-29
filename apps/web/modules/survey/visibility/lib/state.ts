import type { TSurveyVisibility } from "@formbricks/types/surveys/types";

type TVisibilityState = Readonly<{ visibility: TSurveyVisibility; pending?: TSurveyVisibility | null }>;
type TAccess = Readonly<{ canManageVisibility: boolean; via: string }>;

/**
 * Restricted as far as the UI is concerned: enforced restricted, or any change still in flight. List
 * items already carry the enforced value; `pending` only comes from the visibility sub-resource.
 */
export const isEffectivelyRestricted = (state: TVisibilityState): boolean =>
  state.visibility === "restricted" || (state.pending !== null && state.pending !== undefined);

/** Visibility controls need the server-side gate and the per-survey right to change it. */
export const showVisibilityControls = (gate: boolean, access?: Pick<TAccess, "canManageVisibility"> | null) =>
  gate && !!access?.canManageVisibility;

/** The viewer sees this survey only through their organization role (owner or manager), not as its author. */
export const isRoleOnlyAccess = (access?: Pick<TAccess, "via"> | null): boolean =>
  access?.via === "organizationRole";
