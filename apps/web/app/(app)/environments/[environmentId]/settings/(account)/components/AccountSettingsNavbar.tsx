"use client";

import { usePathname } from "next/navigation";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { SecondaryNavigation } from "@formbricks/ui/components/SecondaryNavigation";

interface AccountSettingsNavbarProps {
  environmentId?: string;
  activeId: string;
  loading?: boolean;
}

export const AccountSettingsNavbar = ({ environmentId, activeId, loading }: AccountSettingsNavbarProps) => {
  const pathname = usePathname();
  const navigation = [
    {
      id: "profile",
      label: "Profile",
      href: `/environments/${environmentId}/settings/profile`,
      current: pathname?.includes("/profile"),
    },
    {
      id: "notifications",
      label: "Notifications",
      href: `/environments/${environmentId}/settings/notifications`,
      current: pathname?.includes("/notifications"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
