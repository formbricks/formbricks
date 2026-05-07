"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/modules/ui/components/badge";
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
      id: "feedback-records",
      label: t("workspace.unify.feedback_records"),
      href: `${baseHref}/feedback-records`,
    },
    {
      id: "topics-subtopics",
      label: (
        <span className="inline-flex items-center gap-2">
          {t("workspace.unify.topics_and_subtopics")}
          <Badge text={t("common.preview")} type="gray" size="tiny" />
        </span>
      ),
      href: `${baseHref}/topics-subtopics`,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
