import "server-only";
import {
  getIsContactsEnabled,
  getIsFeedbackDirectoriesEnabled,
  getIsWorkflowsEnabled,
} from "@/modules/ee/license-check/lib/utils";

/**
 * The workspace navigation items an organization can hide when its plan or licence does not include them.
 * `true` hides the item. Only the navigation item goes: a direct link still opens the page and its
 * upgrade or empty state.
 */
export type THiddenNavigationItems = {
  workflows: boolean;
  feedbackData: boolean;
  contacts: boolean;
};

export const NO_HIDDEN_NAVIGATION_ITEMS: THiddenNavigationItems = {
  workflows: false,
  feedbackData: false,
  contacts: false,
};

/**
 * Which navigation items to hide for everyone in the organization. Nothing is hidden unless an owner or
 * manager turned on "Hide unavailable features"; then each item hides while the plan or licence lacks it.
 *
 * TODO: Contacts should also hide while the workspace has no contact directory, once
 * `Workspace.contactDirectoryId` lands (formbricks/formbricks#10214).
 */
export const getHiddenNavigationItems = async (organization: {
  id: string;
  hideUnavailableFeatures: boolean;
}): Promise<THiddenNavigationItems> => {
  // Off is the default: skip the licence checks entirely.
  if (!organization.hideUnavailableFeatures) return NO_HIDDEN_NAVIGATION_ITEMS;

  const [isWorkflowsEnabled, isFeedbackDirectoriesEnabled, isContactsEnabled] = await Promise.all([
    getIsWorkflowsEnabled(organization.id),
    getIsFeedbackDirectoriesEnabled(organization.id),
    getIsContactsEnabled(organization.id),
  ]);

  return {
    workflows: !isWorkflowsEnabled,
    feedbackData: !isFeedbackDirectoriesEnabled,
    contacts: !isContactsEnabled,
  };
};
