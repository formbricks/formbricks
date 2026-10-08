"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { useTranslation } from "react-i18next";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface DataRetentionSecondaryNavigationProps {
  organizationId: string;
  /** History names the people a run notified or deactivated, so it's owners and managers only. */
  canManage: boolean;
}

export const DataRetentionSecondaryNavigation = ({
  organizationId,
  canManage,
}: Readonly<DataRetentionSecondaryNavigationProps>) => {
  const { t } = useTranslation();
  // The layout renders this nav, so the active tab comes from the child route segment.
  const activeId = useSelectedLayoutSegment() ?? "history";

  const navigation = [
    {
      id: "history",
      label: t("workspace.settings.data_retention.history"),
      href: organizationSettingsPath(organizationId, "data-retention/history"),
      hidden: !canManage,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} />;
};
