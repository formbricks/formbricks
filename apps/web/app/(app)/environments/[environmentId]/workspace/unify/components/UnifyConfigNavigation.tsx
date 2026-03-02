"use client";

import { useTranslation } from "react-i18next";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface UnifyConfigNavigationProps {
  environmentId: string;
  activeId?: string;
  loading?: boolean;
}

export const UnifyConfigNavigation = ({
  environmentId,
  activeId: activeIdProp,
  loading,
}: UnifyConfigNavigationProps) => {
  const { t } = useTranslation();
  const baseHref = `/environments/${environmentId}/workspace/unify`;

  const activeId = activeIdProp ?? "sources";

  const navigation = [
    { id: "sources", label: t("environments.unify.sources"), href: `${baseHref}/sources` },
    {
      id: "feedback-records",
      label: t("environments.unify.feedback_records"),
      href: `${baseHref}/feedback-records`,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
