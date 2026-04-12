import { TOrganizationRole } from "@formbricks/types/memberships";
import { getAccessFlags } from "@/lib/membership/utils";

export interface SettingsNavItem {
  id: string;
  label: string;
  href: string;
  hidden?: boolean;
  disabled?: boolean;
  disabledMessage?: string;
}

interface WorkspaceNavOptions {
  environmentId: string;
}

interface OrganizationNavOptions {
  environmentId: string;
  isFormbricksCloud: boolean;
  membershipRole?: TOrganizationRole;
}

interface AccountNavOptions {
  environmentId: string;
}

export const getWorkspaceNavItems = ({ environmentId }: WorkspaceNavOptions): SettingsNavItem[] => [
  {
    id: "general",
    label: "common.general",
    href: `/environments/${environmentId}/settings/workspace/general`,
  },
  {
    id: "team-access",
    label: "common.team_access",
    href: `/environments/${environmentId}/settings/workspace/team-access`,
  },
  {
    id: "languages",
    label: "common.survey_languages",
    href: `/environments/${environmentId}/settings/workspace/languages`,
  },
  {
    id: "connect",
    label: "common.website_and_app_connection",
    href: `/environments/${environmentId}/settings/workspace/connect`,
  },
  {
    id: "integrations",
    label: "common.integrations",
    href: `/environments/${environmentId}/settings/workspace/integrations`,
  },
  {
    id: "appearance",
    label: "common.look_and_feel",
    href: `/environments/${environmentId}/settings/workspace/appearance`,
  },
  {
    id: "user-actions",
    label: "common.actions",
    href: `/environments/${environmentId}/settings/workspace/user-actions`,
  },
  {
    id: "tags",
    label: "common.tags",
    href: `/environments/${environmentId}/settings/workspace/tags`,
  },
];

export const getOrganizationNavItems = ({
  environmentId,
  isFormbricksCloud,
  membershipRole,
}: OrganizationNavOptions): SettingsNavItem[] => {
  const { isMember, isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;
  const isMembershipPending = membershipRole === undefined;

  return [
    {
      id: "general",
      label: "common.general",
      href: `/environments/${environmentId}/settings/organization/general`,
    },
    {
      id: "teams",
      label: "common.members_and_teams",
      href: `/environments/${environmentId}/settings/organization/teams`,
    },
    {
      id: "api-keys",
      label: "common.api_keys",
      href: `/environments/${environmentId}/settings/organization/api-keys`,
      disabled: isMembershipPending || !isOwnerOrManager,
      disabledMessage: isMembershipPending
        ? "common.loading"
        : "common.you_are_not_authorized_to_perform_this_action",
    },
    {
      id: "domain",
      label: "common.domain",
      href: `/environments/${environmentId}/settings/organization/domain`,
      hidden: isFormbricksCloud,
    },
    {
      id: "billing",
      label: "common.billing",
      href: `/environments/${environmentId}/settings/organization/billing`,
      hidden: !isFormbricksCloud,
    },
    {
      id: "enterprise",
      label: "common.enterprise_license",
      href: `/environments/${environmentId}/settings/organization/enterprise`,
      hidden: isFormbricksCloud,
      disabled: isMembershipPending || isMember,
      disabledMessage: isMembershipPending
        ? "common.loading"
        : "common.you_are_not_authorized_to_perform_this_action",
    },
  ];
};

export const getAccountNavItems = ({ environmentId }: AccountNavOptions): SettingsNavItem[] => [
  {
    id: "profile",
    label: "common.profile",
    href: `/environments/${environmentId}/settings/account/profile`,
  },
  {
    id: "notifications",
    label: "common.notifications",
    href: `/environments/${environmentId}/settings/account/notifications`,
  },
];
