"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface AccountSettingsNavbarProps {
  activeId: string;
  loading?: boolean;
}

export const AccountSettingsNavbar = ({ activeId, loading }: AccountSettingsNavbarProps) => {
  const pathname = usePathname();
  const { t } = useTranslation();
  const navigation = [
    {
      id: "profile",
      label: t("common.profile"),
      href: `/account/settings/profile`,
      current: pathname?.includes("/profile"),
    },
    {
      id: "notifications",
      label: t("common.notifications"),
      href: `/account/settings/notifications`,
      current: pathname?.includes("/notifications"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
