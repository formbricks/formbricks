import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import type { TSurveyVisibilityBlocker } from "../types";
import { classifyVisibilityError } from "./errors";
import { isEffectivelyRestricted } from "./state";

/**
 * The value the Collaborate modal shows as current. A change still in flight shows as Restricted —
 * a pending grant has not reached anyone yet, and a pending restriction already applies.
 */
export const getDisplayedVisibility = (
  state: Readonly<{ visibility: TSurveyVisibility; pending: TSurveyVisibility | null }>
): TSurveyVisibility => (isEffectivelyRestricted(state) ? "restricted" : "workspace");

/** Save is offered only for a different value the server would accept right now. */
export const canSaveVisibility = ({
  current,
  selected,
  allowedTargets,
}: Readonly<{
  current: TSurveyVisibility;
  selected: TSurveyVisibility | null;
  allowedTargets: readonly TSurveyVisibility[];
}>): boolean => selected !== null && selected !== current && allowedTargets.includes(selected);

/** Visible → Restricted always confirms; Restricted → Visible never does. */
export const needsRestrictConfirmation = (target: TSurveyVisibility): boolean => target === "restricted";

/**
 * How a dialog reacts to a failed change:
 *
 * - `pending`: the change is stored and finishes on its own; report it as saved.
 * - `hide_controls`: the feature is off for this organization; close and hide the controls.
 * - `refetch_blockers`: a connection appeared meanwhile; reload the list of blockers.
 * - `show_error`: anything else; toast the problem and stay open.
 */
export type TVisibilityErrorReaction = "pending" | "hide_controls" | "refetch_blockers" | "show_error";

export const getVisibilityErrorReaction = (error: unknown): TVisibilityErrorReaction => {
  switch (classifyVisibilityError(error)) {
    case "pending":
      return "pending";
    case "not_enabled":
      return "hide_controls";
    case "blocked":
      return "refetch_blockers";
    default:
      return "show_error";
  }
};

/**
 * Who the Restricted copy names as the person who keeps access: "You" only when the viewer is known to
 * be the author (`via: "owner"`). On a workspace-visible survey everyone reads `via: "workspace"`, so the
 * author is named instead; with no author left the copy says "The author".
 */
export type TRestrictedAuthor = Readonly<
  { kind: "you" } | { kind: "named"; name: string } | { kind: "unknown" }
>;

export const getRestrictedAuthor = (
  access: Readonly<{ via: string }> | null,
  ownerName: string | null
): TRestrictedAuthor => {
  if (access?.via === "owner") return { kind: "you" };
  if (ownerName) return { kind: "named", name: ownerName };
  return { kind: "unknown" };
};

export type TBlockerGroup = Readonly<{ type: TSurveyVisibilityBlocker["type"]; names: string[] }>;

const BLOCKER_TYPE_ORDER: readonly TSurveyVisibilityBlocker["type"][] = [
  "feedbackSource",
  "integration",
  "webhook",
  "workflow",
  "dashboard",
];

/** Blockers grouped by type in a fixed order, names sorted, so the warning reads the same every time. */
export const groupBlockersByType = (blockers: readonly TSurveyVisibilityBlocker[]): TBlockerGroup[] =>
  BLOCKER_TYPE_ORDER.map((type) => ({
    type,
    names: blockers
      .filter((blocker) => blocker.type === type)
      .map((blocker) => blocker.name)
      .sort((left, right) => left.localeCompare(right)),
  })).filter((group) => group.names.length > 0);

/**
 * Whether the Collaborate modal explains why Restricted is unavailable: the survey is visible to the
 * workspace now, connections depend on it, and so the server does not offer Restricted. "Unavailable"
 * for any other reason (no owner, say) keeps its plain badge.
 */
export const showBlockersInCollaborate = (
  current: TSurveyVisibility | null,
  state: Readonly<{
    blockers: readonly TSurveyVisibilityBlocker[];
    allowedTargets: readonly TSurveyVisibility[];
  }>
): boolean =>
  current === "workspace" && state.blockers.length > 0 && !state.allowedTargets.includes("restricted");
