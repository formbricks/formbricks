import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import { RESTRICTED_BANNER_DISMISSED_KEY_PREFIX } from "./constants";
import { isRoleOnlyAccess } from "./state";

type TMarkerInput = Readonly<{
  gate: boolean;
  visibility: TSurveyVisibility;
  access: Readonly<{ via: string }> | null;
  owner: Readonly<{ name: string }> | null;
}>;

/**
 * The marker a survey list row carries in the Created by column: `author_gone` for a restricted
 * survey whose author no longer has an account (it wins — the row needs attention whoever looks at
 * it), `role` for a restricted survey the viewer sees only through their organization role, else none.
 */
export const getRestrictedRowMarker = ({
  gate,
  visibility,
  access,
  owner,
}: TMarkerInput): "author_gone" | "role" | null => {
  if (!gate || visibility !== "restricted") return null;
  if (owner === null) return "author_gone";
  return isRoleOnlyAccess(access) ? "role" : null;
};

/** The Name column's icon: only workspace-visible surveys carry one; restricted ones stay unmarked. */
export const showWorkspaceMarker = ({ gate, visibility }: Pick<TMarkerInput, "gate" | "visibility">) =>
  gate && visibility === "workspace";

/** The restricted banner on the editor, summary and responses pages, for owners and managers only. */
export const showRestrictedBanner = ({ gate, visibility, access }: Omit<TMarkerInput, "owner">): boolean =>
  gate && visibility === "restricted" && isRoleOnlyAccess(access);

export const getRestrictedBannerDismissedKey = (surveyId: string): string =>
  `${RESTRICTED_BANNER_DISMISSED_KEY_PREFIX}${surveyId}`;

type TSessionStorage = Pick<Storage, "getItem" | "setItem">;

/** Dismissal lasts one browser session per survey. Storage can be missing or throw; that reads as not dismissed. */
export const readRestrictedBannerDismissed = (
  storage: TSessionStorage | undefined,
  surveyId: string
): boolean => {
  try {
    return storage?.getItem(getRestrictedBannerDismissedKey(surveyId)) === "1";
  } catch {
    return false;
  }
};

export const writeRestrictedBannerDismissed = (storage: TSessionStorage | undefined, surveyId: string) => {
  try {
    storage?.setItem(getRestrictedBannerDismissedKey(surveyId), "1");
  } catch {
    // Blocked storage only means the banner comes back on the next page load.
  }
};
