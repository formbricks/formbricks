"use client";

import { usePathname } from "next/navigation";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";
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
  membershipRole?: TOrganizationRole;
  activeId: string;
  loading?: boolean;
}) => {
  const pathname = usePathname();
  const { isManager, isOwner } = getAccessFlags(membershipRole);
  const isPricingDisabled = !isOwner && !isManager;

  const navigation = [
    {
      id: "general",
      label: "General",
      href: `/environments/${environmentId}/settings/general`,
      current: pathname?.includes("/general"),
      hidden: false,
    },
    {
      id: "billing",
      label: "Billing & Plan",
      href: `/environments/${environmentId}/settings/billing`,
      hidden: !isFormbricksCloud || isPricingDisabled,
      current: pathname?.includes("/billing"),
    },
    {
      id: "teams",
      label: "Teams",
      href: `/environments/${environmentId}/settings/teams`,
      // hidden: isFormbricksCloud || isPricingDisabled,
      hidden: false,
      current: pathname?.includes("/teams"),
    },
    {
      id: "enterprise",
      label: "Enterprise License",
      href: `/environments/${environmentId}/settings/enterprise`,
      hidden: isFormbricksCloud || isPricingDisabled,
      current: pathname?.includes("/enterprise"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
