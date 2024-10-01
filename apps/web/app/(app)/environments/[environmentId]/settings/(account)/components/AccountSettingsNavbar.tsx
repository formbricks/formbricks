"use client";

import { UserCircleIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { SecondaryNavigation } from "@formbricks/ui/components/SecondaryNavigation";

export const AccountSettingsNavbar = ({
  environmentId,
  activeId,
}: {
  environmentId: string;
  activeId: string;
}) => {
  const pathname = usePathname();
  const navigation = [
    {
      id: "profile",
      label: "Profile",
      href: `/environments/${environmentId}/settings/profile`,
      icon: <UserCircleIcon className="h-5 w-5" />,
      current: pathname?.includes("/profile"),
    },
    // {
    //   id: "notifications",
    //   label: "Notifications",
    //   href: `/environments/${environmentId}/settings/notifications`,
    //   icon: <BellRingIcon className="h-5 w-5" />,
    //   current: pathname?.includes("/notifications"),
    // },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} />;
};
