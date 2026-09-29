"use client";

import { useTranslation } from "react-i18next";
import type { TRestrictedAuthor } from "@/modules/survey/visibility/lib/collaborate";

/**
 * The two visibility options' labels and descriptions, shared by the Collaborate modal, the Activate
 * dialog and the Restrict confirmation so the three always describe the choice the same way.
 */
export const useVisibilityCopy = ({
  workspaceName,
  author,
}: Readonly<{ workspaceName: string; author: TRestrictedAuthor }>) => {
  const { t } = useTranslation();
  const authorName = author.kind === "named" ? author.name : t("workspace.surveys.visibility.the_author");

  return {
    restrictedLabel: t("workspace.surveys.visibility.restricted"),
    restrictedDescription:
      author.kind === "you"
        ? t("workspace.surveys.visibility.restricted_description")
        : t("workspace.surveys.visibility.restricted_description_author", { author: authorName }),
    restrictedAccess:
      author.kind === "you"
        ? t("workspace.surveys.visibility.you_and_owners_managers")
        : t("workspace.surveys.visibility.author_and_owners_managers", { author: authorName }),
    workspaceLabel: t("workspace.surveys.visibility.visible_to_workspace", { workspace: workspaceName }),
    workspaceDescription: t("workspace.surveys.visibility.workspace_description", {
      workspace: workspaceName,
    }),
    workspaceAccess: t("workspace.surveys.visibility.everyone_in_workspace_and_owners_managers", {
      workspace: workspaceName,
    }),
  };
};
