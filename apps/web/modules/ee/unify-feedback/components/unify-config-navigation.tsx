"use client";

import { useTranslation } from "react-i18next";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface UnifyConfigNavigationProps {
  workspaceId: string;
  activeId?: string;
  loading?: boolean;
}

export const UnifyConfigNavigation = ({
  workspaceId,
  activeId: activeIdProp,
  loading,
}: UnifyConfigNavigationProps) => {
  const { t } = useTranslation();
  const baseHref = `/workspaces/${workspaceId}/unify`;

  const activeId = activeIdProp ?? "feedback-records";

  const navigation = [
    {
      id: "sources",
      label: t("workspace.unify.feedback_sources"),
      href: `${baseHref}/sources`,
    },
    {
      id: "feedback-records",
      label: t("workspace.unify.feedback_records"),
      href: `${baseHref}/feedback-records`,
    },
    {
      id: "taxonomy",
      label: t("workspace.unify.topics_and_subtopics"),
      href: `${baseHref}/taxonomy`,
    },
  ];

  return (
    <SecondaryNavigation
      navigation={navigation}
      activeId={activeId}
      loading={loading}
      variant="steps"
      ariaLabel={t("workspace.unify.unify_feedback")}
    />
  );
};
