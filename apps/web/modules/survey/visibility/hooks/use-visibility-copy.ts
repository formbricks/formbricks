"use client";

import { useTranslation } from "react-i18next";
import type { TRestrictedAuthor } from "@/modules/survey/visibility/lib/collaborate";

type TTranslate = ReturnType<typeof useTranslation>["t"];

/** The Restricted option's description, naming the author by their role on the survey. */
const getRestrictedDescription = (t: TTranslate, author: TRestrictedAuthor): string => {
  switch (author.kind) {
    case "you":
      return t("workspace.surveys.visibility.restricted_description");
    case "named":
      return t("workspace.surveys.visibility.restricted_description_author", { author: author.name });
    default:
      return t("workspace.surveys.visibility.restricted_description_no_author");
  }
};

/** Who can access a restricted survey, naming the author by their role on the survey. */
const getRestrictedAccess = (t: TTranslate, author: TRestrictedAuthor): string => {
  switch (author.kind) {
    case "you":
      return t("workspace.surveys.visibility.you_and_owners_managers");
    case "named":
      return t("workspace.surveys.visibility.author_and_owners_managers", { author: author.name });
    default:
      return t("workspace.surveys.visibility.owners_managers");
  }
};

/**
 * The two visibility options' labels and descriptions, shared by the Collaborate modal, the Activate
 * dialog and the Restrict confirmation so the three always describe the choice the same way.
 */
export const useVisibilityCopy = ({
  workspaceName,
  author,
}: Readonly<{ workspaceName: string; author: TRestrictedAuthor }>) => {
  const { t } = useTranslation();

  return {
    restrictedLabel: t("workspace.surveys.visibility.restricted"),
    restrictedDescription: getRestrictedDescription(t, author),
    restrictedAccess: getRestrictedAccess(t, author),
    workspaceLabel: t("workspace.surveys.visibility.visible_to_workspace", { workspace: workspaceName }),
    workspaceDescription: t("workspace.surveys.visibility.workspace_description", {
      workspace: workspaceName,
    }),
    workspaceAccess: t("workspace.surveys.visibility.everyone_in_workspace_and_owners_managers", {
      workspace: workspaceName,
    }),
  };
};
