import { type TCustomCssCompiled, type TCustomCssInput } from "@formbricks/types/custom-css";
import { type TCustomCssHealthStatus } from "./lib/api-client";

/**
 * Computed by the Look & Feel page loader. The card is not rendered at all when the rollout flag is
 * off; everything here mirrors the server's own checks, which stay authoritative.
 */
export interface TWorkspaceCustomCssAccess {
  /** Organization owner or manager (D15). */
  canEdit: boolean;
  /** Cloud: the Scale `custom-css` entitlement. Self-hosted: always true. */
  planAllowed: boolean;
  /** Self-hosted only: the workspace's Custom Head Scripts carry page styles. */
  hasHeadScriptStyles: boolean;
  /** Where the plan's upgrade lives; `null` on self-hosted, which has no plan gate. */
  billingHref: string | null;
}

/** Computed by the survey editor page loader; `null` there when the rollout flag hides the card. */
export interface TSurveyCustomCssEditorConfig {
  /** Cloud: the Scale `custom-css` entitlement. Self-hosted: always true. */
  planAllowed: boolean;
  billingHref: string | null;
  /** Self-hosted only: the workspace's or survey's Custom Head Scripts carry page styles. */
  hasHeadScriptStyles: boolean;
  /** Health of the survey's saved CSS. */
  surveyStatus: TCustomCssHealthStatus;
  /** The inherited workspace CSS: source to show read-only, compiled output for the preview. */
  workspace: {
    source: TCustomCssInput | null;
    compiled: TCustomCssCompiled | null;
    status: TCustomCssHealthStatus;
  };
}
