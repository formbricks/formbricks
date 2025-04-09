"use client";

import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";
import { useTranslate } from "@tolgee/react";
import { usePathname } from "next/navigation";

interface OrganizationSettingsNavbarProps {
  environmentId?: string;
  activeId: string;
  loading?: boolean;
}

export const OrganizationSettingsNavbar = ({
  environmentId,
  activeId,
  loading,
}: OrganizationSettingsNavbarProps) => {
  const pathname = usePathname();
  const { t } = useTranslate();

  const navigation = [
    {
      id: "general",
      label: t("common.general"),
      href: `/environments/${environmentId}/settings/general`,
      current: pathname?.includes("/general"),
      hidden: false,
    },
    // {
    //   id: "teams",
    //   label: t("common.teams"),
    //   href: `/environments/${environmentId}/settings/teams`,
    //   current: pathname?.includes("/teams"),
    // },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
