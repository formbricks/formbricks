import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import { classifyVisibilityError } from "./errors";
import { showVisibilityControls } from "./state";

type TAccess = Readonly<{ canManageVisibility: boolean }>;

/**
 * Activating (or scheduling) a restricted survey first asks who can view it — but only someone who
 * could change the answer. A workspace-visible survey activates exactly as before.
 */
export const shouldAskWhoCanView = ({
  gate,
  access,
  visibility,
}: Readonly<{ gate: boolean; access: TAccess | null; visibility: TSurveyVisibility }>): boolean =>
  showVisibilityControls(gate, access) && visibility === "restricted";

/** What the visibility change the Activate dialog made (if any) came back with. */
export type TActivationVisibilityOutcome = Readonly<{ ok: true } | { ok: false; error: unknown }>;

export type TActivationStep =
  /** Make the survey visible to the workspace, then plan again with the outcome. */
  | Readonly<{ kind: "change_visibility" }>
  /** Run the existing activate / schedule path. `pending`: the grant is stored but not yet in effect. */
  | Readonly<{ kind: "activate"; pending: boolean }>
  /** Stop without activating. `hideControls`: the feature is off for this organization. */
  | Readonly<{ kind: "abort"; hideControls: boolean }>;

/**
 * The Activate dialog's next step. Restricted activates directly. Visible first changes visibility;
 * a pending grant (503) does not block activation — it finishes on its own — while the feature being
 * off, or any other failure, stops before anything is activated.
 */
export const planActivation = (
  choice: TSurveyVisibility,
  outcome?: TActivationVisibilityOutcome
): TActivationStep => {
  if (choice === "restricted") return { kind: "activate", pending: false };
  if (!outcome) return { kind: "change_visibility" };
  if (outcome.ok) return { kind: "activate", pending: false };

  const errorKind = classifyVisibilityError(outcome.error);
  if (errorKind === "pending") return { kind: "activate", pending: true };
  return { kind: "abort", hideControls: errorKind === "not_enabled" };
};
