import type { TSurveyVisibility } from "@formbricks/types/surveys/types";

type TVisibilityState = Readonly<{ visibility: TSurveyVisibility; pending?: TSurveyVisibility | null }>;
type TAccess = Readonly<{ canManageVisibility: boolean; via: string }>;

/**
 * The server-side switches the restricted-surveys UI reads (ENG-3395), computed on the server and
 * passed down as a prop — the client never decides them on its own. They follow the two gates of the
 * ENG-3282 contract:
 *
 * - `enforced`: the deployment's readiness marker. Everything that describes what is enforced follows
 *   it — markers, banners, the Follow-ups notice, outbound pickers refusing restricted surveys — because
 *   the server keeps enforcing restricted surveys for as long as the marker is set, entitlement or not.
 * - `manageable`: readiness and the organization's entitlement. Only the controls that *change*
 *   visibility (Collaborate, the Activate dialog, "Make visible") follow it, together with the
 *   per-survey `access.canManageVisibility`.
 *
 * With both off the product looks exactly as it did before ENG-3395.
 */
export type TSurveyVisibilityUiGate = Readonly<{ enforced: boolean; manageable: boolean }>;

/** The same gate once the server has answered `visibility_not_enabled`: display stays, controls go. */
export const withoutVisibilityControls = (gate: TSurveyVisibilityUiGate): TSurveyVisibilityUiGate => ({
  enforced: gate.enforced,
  manageable: false,
});

/**
 * Restricted as far as the UI is concerned: enforced restricted, or any change still in flight. List
 * items already carry the enforced value; `pending` only comes from the visibility sub-resource.
 */
export const isEffectivelyRestricted = (state: TVisibilityState): boolean =>
  state.visibility === "restricted" || (state.pending !== null && state.pending !== undefined);

/**
 * Outbound plumbing — follow-ups, webhooks, integrations, feedback sources, workflows — only ever
 * serves workspace-visible surveys: the server refuses to attach a restricted one and skips it at
 * dispatch. Pickers and the Follow-ups tab use this to say so up front. Always false while visibility
 * is not enforced (`TSurveyVisibilityUiGate.enforced`).
 */
export const isOutboundBlocked = (enforced: boolean, state: TVisibilityState): boolean =>
  enforced && isEffectivelyRestricted(state);

/** Visibility controls need the entitlement (`manageable`) and the per-survey right to change it. */
export const showVisibilityControls = (
  gate: Pick<TSurveyVisibilityUiGate, "manageable">,
  access?: Pick<TAccess, "canManageVisibility"> | null
): boolean => gate.manageable && !!access?.canManageVisibility;

/** The viewer sees this survey only through their organization role (owner or manager), not as its author. */
export const isRoleOnlyAccess = (access?: Pick<TAccess, "via"> | null): boolean =>
  access?.via === "organizationRole";
