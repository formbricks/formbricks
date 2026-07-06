"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface AccountSettingsNavbarProps {
  activeId: string;
  loading?: boolean;
}

export const AccountSettingsNavbar = ({ activeId, loading }: Readonly<AccountSettingsNavbarProps>) => {
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
    {
      id: "authorized-apps",
      label: t("common.authorized_apps"),
      href: `/account/settings/authorized-apps`,
      current: pathname?.includes("/authorized-apps"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
