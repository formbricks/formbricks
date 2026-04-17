"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { getAccessFlags } from "@/lib/membership/utils";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

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
  const { isMember, isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;
  const isMembershipPending = membershipRole === undefined || loading;
  const { t } = useTranslation();

  const navigation = [
    {
      id: "general",
      label: t("common.general"),
      href: `/environments/${environmentId}/settings/general`,
      current: pathname?.includes("/general"),
      hidden: false,
    },
    {
      id: "teams",
      label: t("common.members_and_teams"),
      href: `/environments/${environmentId}/settings/teams`,
      current: pathname?.includes("/teams"),
    },
    {
      id: "api-keys",
      label: t("common.api_keys"),
      href: `/environments/${environmentId}/settings/api-keys`,
      current: pathname?.includes("/api-keys"),
      disabled: isMembershipPending || !isOwnerOrManager,
      disabledMessage: isMembershipPending
        ? t("common.loading")
        : t("common.you_are_not_authorized_to_perform_this_action"),
    },
    {
      id: "domain",
      label: t("common.domain"),
      href: `/environments/${environmentId}/settings/domain`,
      current: pathname?.includes("/domain"),
      hidden: isFormbricksCloud,
    },
    {
      id: "billing",
      label: t("common.billing"),
      href: `/environments/${environmentId}/settings/billing`,
      hidden: !isFormbricksCloud,
      current: pathname?.includes("/billing"),
    },
    {
      id: "enterprise",
      label: t("common.enterprise_license"),
      href: `/environments/${environmentId}/settings/enterprise`,
      hidden: isFormbricksCloud,
      disabled: isMembershipPending || isMember,
      disabledMessage: isMembershipPending
        ? t("common.loading")
        : t("common.you_are_not_authorized_to_perform_this_action"),
      current: pathname?.includes("/enterprise"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
