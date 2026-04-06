"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/environment-context";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface AccountSettingsNavbarProps {
  environmentId?: string;
  activeId: string;
  loading?: boolean;
}

export const AccountSettingsNavbar = ({ activeId, loading }: AccountSettingsNavbarProps) => {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const workspaceBasePath = `/workspaces/${workspace?.id}`;
  const navigation = [
    {
      id: "profile",
      label: t("common.profile"),
      href: `${workspaceBasePath}/settings/profile`,
      current: pathname?.includes("/profile"),
    },
    {
      id: "notifications",
      label: t("common.notifications"),
      href: `${workspaceBasePath}/settings/notifications`,
      current: pathname?.includes("/notifications"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
