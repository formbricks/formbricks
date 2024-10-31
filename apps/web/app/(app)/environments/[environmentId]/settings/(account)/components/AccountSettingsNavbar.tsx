"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { SecondaryNavigation } from "@formbricks/ui/components/SecondaryNavigation";

interface AccountSettingsNavbarProps {
  environmentId?: string;
  activeId: string;
  loading?: boolean;
}

export const AccountSettingsNavbar = ({ environmentId, activeId, loading }: AccountSettingsNavbarProps) => {
  const pathname = usePathname();
  const t = useTranslations();
  const navigation = [
    {
      id: "profile",
      label: t("common.profile"),
      href: `/environments/${environmentId}/settings/profile`,
      current: pathname?.includes("/profile"),
    },
    {
      id: "notifications",
      label: t("common.notifications"),
      href: `/environments/${environmentId}/settings/notifications`,
      current: pathname?.includes("/notifications"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
