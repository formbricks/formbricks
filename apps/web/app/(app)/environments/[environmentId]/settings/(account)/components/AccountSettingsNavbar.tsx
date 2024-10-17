"use client";

import { BellRingIcon, UserCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { SecondaryNavigation } from "@formbricks/ui/components/SecondaryNavigation";

export const AccountSettingsNavbar = ({
  environmentId,
  activeId,
  loading,
}: {
  activeId: string;
  environmentId?: string;
  loading?: boolean;
}) => {
  const pathname = usePathname();
  const t = useTranslations();
  const navigation = [
    {
      id: "profile",
      label: t("common.profile"),
      href: `/environments/${environmentId}/settings/profile`,
      icon: <UserCircleIcon className="h-5 w-5" />,
      current: pathname?.includes("/profile"),
    },
    {
      id: "notifications",
      label: t("common.notifications"),
      href: `/environments/${environmentId}/settings/notifications`,
      icon: <BellRingIcon className="h-5 w-5" />,
      current: pathname?.includes("/notifications"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
