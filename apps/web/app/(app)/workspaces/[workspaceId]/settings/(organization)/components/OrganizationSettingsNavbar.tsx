"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { getAccessFlags } from "@/lib/membership/utils";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface OrganizationSettingsNavbarProps {
  isFormbricksCloud: boolean;
  membershipRole?: TOrganizationRole;
  activeId: string;
  loading?: boolean;
}

export const OrganizationSettingsNavbar = ({
  isFormbricksCloud,
  membershipRole,
  activeId,
  loading,
}: OrganizationSettingsNavbarProps) => {
  const pathname = usePathname();
  const { isMember, isOwner } = getAccessFlags(membershipRole);
  const isPricingDisabled = isMember;
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const workspaceBasePath = `/workspaces/${workspace?.id}`;

  const navigation = [
    {
      id: "general",
      label: t("common.general"),
      href: `${workspaceBasePath}/settings/general`,
      current: pathname?.includes("/general"),
      hidden: false,
    },
    {
      id: "teams",
      label: t("common.members_and_teams"),
      href: `${workspaceBasePath}/settings/teams`,
      current: pathname?.includes("/teams"),
    },
    {
      id: "feedback-record-directories",
      label: t("workspace.settings.feedback_record_directories.nav_label"),
      href: `${workspaceBasePath}/settings/feedback-record-directories`,
      current: pathname?.includes("/feedback-record-directories"),
      hidden: isMember,
    },
    {
      id: "api-keys",
      label: t("common.api_keys"),
      href: `${workspaceBasePath}/settings/api-keys`,
      current: pathname?.includes("/api-keys"),
      hidden: !isOwner,
    },
    {
      id: "domain",
      label: t("common.domain"),
      href: `${workspaceBasePath}/settings/domain`,
      current: pathname?.includes("/domain"),
      hidden: isFormbricksCloud,
    },
    {
      id: "billing",
      label: t("common.billing"),
      href: `${workspaceBasePath}/settings/billing`,
      hidden: !isFormbricksCloud || loading,
      current: pathname?.includes("/billing"),
    },
    {
      id: "enterprise",
      label: t("common.enterprise_license"),
      href: `${workspaceBasePath}/settings/enterprise`,
      hidden: isFormbricksCloud || isPricingDisabled,
      current: pathname?.includes("/enterprise"),
    },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
