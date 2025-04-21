"use client";

import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";
import { useTranslate } from "@tolgee/react";
import { usePathname } from "next/navigation";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface OrganizationSettingsNavbarProps {
  environmentId?: string;
  isFormbricksCloud: boolean;
  membershipRole?: TOrganizationRole;
  activeId: string;
  loading?: boolean;
}

export const OrganizationSettingsNavbar = ({
  environmentId,
  isFormbricksCloud,
  membershipRole,
  activeId,
  loading,
}: OrganizationSettingsNavbarProps) => {
  const pathname = usePathname();
  const { isMember, isOwner } = getAccessFlags(membershipRole);
  const isPricingDisabled = isMember;
  const { t } = useTranslate();

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
      hidden: !isFormbricksCloud || loading,
      current: pathname?.includes("/billing"),
    },
    {
      id: "teams",
      label: t("common.teams"),
      href: `/environments/${environmentId}/settings/teams`,
      current: pathname?.includes("/teams"),
    },
    {
      id: "enterprise",
      label: t("common.enterprise_license"),
      href: `/environments/${environmentId}/settings/enterprise`,
      hidden: isFormbricksCloud || isPricingDisabled,
      current: pathname?.includes("/enterprise"),
    },
    {
      id: "api-keys",
      label: t("common.api_keys"),
      href: `/environments/${environmentId}/settings/api-keys`,
      current: pathname?.includes("/api-keys"),
      hidden: !isOwner,
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
