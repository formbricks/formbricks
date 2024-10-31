"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { SecondaryNavigation } from "@formbricks/ui/components/SecondaryNavigation";

interface OrganizationSettingsNavbarProps {
  environmentId?: string;
  isFormbricksCloud: boolean;
  membershipRole?: TOrganizationRole;
  activeId: string;
  loading?: boolean;
  canDoRoleManagement?: boolean;
}

export const OrganizationSettingsNavbar = ({
  environmentId,
  isFormbricksCloud,
  membershipRole,
  activeId,
  loading,
  canDoRoleManagement = false,
}: OrganizationSettingsNavbarProps) => {
  const pathname = usePathname();
  const { isBilling, isMember } = getAccessFlags(membershipRole);
  const isPricingDisabled = isMember;
  const t = useTranslations();

  const navigation = [
    {
      id: "general",
      label: t("common.general"),
      href: `/environments/${environmentId}/settings/general`,
      current: pathname?.includes("/general"),
      hidden: false,
    },
    {
      id: "billing",
      label: t("common.billing"),
      href: `/environments/${environmentId}/settings/billing`,
      hidden: !isFormbricksCloud || isPricingDisabled || loading,
      current: pathname?.includes("/billing"),
    },
    {
      id: "teams",
      label: "Teams",
      href: `/environments/${environmentId}/settings/teams`,
      hidden: !canDoRoleManagement || isBilling,
      current: pathname?.includes("/teams"),
    },
    {
      id: "enterprise",
      label: t("common.enterprise_license"),
      href: `/environments/${environmentId}/settings/enterprise`,
      hidden: isFormbricksCloud || isPricingDisabled,
      current: pathname?.includes("/enterprise"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
