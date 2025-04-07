"use client";

import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";
import { useTranslate } from "@tolgee/react";
import { usePathname } from "next/navigation";

interface AccountSettingsNavbarProps {
  environmentId?: string;
  activeId: string;
  loading?: boolean;
  hasAccess: boolean;
}

export const AccountSettingsNavbar = ({
  environmentId,
  activeId,
  loading,
  hasAccess,
}: AccountSettingsNavbarProps) => {
  const pathname = usePathname();
  const { t } = useTranslate();
  const navigation = [
    {
      id: "profile",
      label: t("common.profile"),
      href: `/environments/${environmentId}/settings/profile`,
      current: pathname?.includes("/profile"),
    },
    ...(hasAccess
      ? [
          {
            id: "notifications",
            label: t("common.notifications"),
            href: `/environments/${environmentId}/settings/notifications`,
            current: pathname?.includes("/notifications"),
          },
        ]
      : []),
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
