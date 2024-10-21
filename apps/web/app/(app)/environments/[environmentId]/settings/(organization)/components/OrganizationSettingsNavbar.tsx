"use client";

import { BoltIcon, CreditCardIcon, UsersIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TMembershipRole } from "@formbricks/types/memberships";
import { SecondaryNavigation } from "@formbricks/ui/components/SecondaryNavigation";

export const OrganizationSettingsNavbar = ({
  environmentId,
  isFormbricksCloud,
  membershipRole,
  activeId,
  loading,
}: {
  environmentId?: string;
  isFormbricksCloud: boolean;
  membershipRole?: TMembershipRole;
  activeId: string;
  loading?: boolean;
}) => {
  const pathname = usePathname();
  const { isAdmin, isOwner } = getAccessFlags(membershipRole);
  const isPricingDisabled = !isOwner && !isAdmin;

  const navigation = [
    {
      id: "general",
      label: "General",
      href: `/environments/${environmentId}/settings/general`,
      icon: <UsersIcon className="h-5 w-5" />,
      current: pathname?.includes("/general"),
      hidden: false,
    },
    {
      id: "billing",
      label: "Billing & Plan",
      href: `/environments/${environmentId}/settings/billing`,
      icon: <CreditCardIcon className="h-5 w-5" />,
      hidden: !isFormbricksCloud || isPricingDisabled,
      current: pathname?.includes("/billing"),
    },
    {
      id: "enterprise",
      label: "Enterprise License",
      href: `/environments/${environmentId}/settings/enterprise`,
      icon: <BoltIcon className="h-5 w-5" />,
      hidden: isFormbricksCloud || isPricingDisabled,
      current: pathname?.includes("/enterprise"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
