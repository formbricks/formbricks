import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import { isRoleOnlyAccess } from "./state";

type TMarkerInput = Readonly<{
  /** `TSurveyVisibilityUiGate.enforced`: markers describe what is enforced, not who may change it. */
  enforced: boolean;
  visibility: TSurveyVisibility;
  access: Readonly<{ via: string }> | null;
  owner: Readonly<{ name: string }> | null;
}>;

/** Extra detail on a restricted row, shown after its name. */
export type TRestrictedRowDetail = "author_gone" | "role";

export type TRowVisibilityMarker = Readonly<
  { kind: "workspace" } | { kind: "restricted"; detail: TRestrictedRowDetail | null }
>;

/**
 * The visibility marker a survey list row carries next to its name: every workspace-visible survey
 * gets the workspace mark and every restricted survey the restricted one, so the two values always
 * read apart. A restricted row adds a detail: `author_gone` when its author no longer has an account
 * (it wins — the row needs attention whoever looks at it), `role` when the viewer sees it only through
 * their organization role. While visibility is not enforced no row is marked.
 */
export const getRowVisibilityMarker = ({
  enforced,
  visibility,
  access,
  owner,
}: TMarkerInput): TRowVisibilityMarker | null => {
  if (!enforced) return null;
  if (visibility === "workspace") return { kind: "workspace" };
  if (owner === null) return { kind: "restricted", detail: "author_gone" };
  return { kind: "restricted", detail: isRoleOnlyAccess(access) ? "role" : null };
};

/**
 * The restricted banner on the editor, summary and responses pages, for owners and managers only.
 * `visibility` is the effective one, so a pending change already shows as restricted.
 */
export const showRestrictedBanner = ({
  enforced,
  visibility,
  access,
}: Omit<TMarkerInput, "owner">): boolean =>
  enforced && visibility === "restricted" && isRoleOnlyAccess(access);
