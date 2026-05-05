import { Session } from "next-auth";
import { z } from "zod";
import { TMembership, ZMembership } from "@formbricks/types/memberships";
import { TOrganization, ZOrganization } from "@formbricks/types/organizations";
import { TUser, ZUser } from "@formbricks/types/user";
import { TWorkspace, ZWorkspace } from "@formbricks/types/workspace";
import {
  TEnterpriseLicenseFeatures,
  TLicenseStatus,
} from "@/modules/ee/license-check/types/enterprise-license";
import { TTeamPermission, ZTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";

// Type for the enterprise license returned by getEnterpriseLicense()
type TEnterpriseLicense = {
  active: boolean;
  features: TEnterpriseLicenseFeatures | null;
  lastChecked: Date;
  isPendingDowngrade: boolean;
  fallbackLevel: string;
  status: TLicenseStatus;
};

export const ZWorkspaceAuth = z.object({
  workspace: ZWorkspace,
  organization: ZOrganization,
  session: z.object({
    user: ZUser.pick({ id: true }),
    expires: z.string(),
  }),
  currentUserMembership: ZMembership,
  workspacePermission: ZTeamPermission.nullable(),
  isMember: z.boolean(),
  isOwner: z.boolean(),
  isManager: z.boolean(),
  isBilling: z.boolean(),
  hasReadAccess: z.boolean(),
  hasReadWriteAccess: z.boolean(),
  hasManageAccess: z.boolean(),
  isReadOnly: z.boolean(),
});

export type TWorkspaceAuth = z.infer<typeof ZWorkspaceAuth>;

/**
 * Complete layout data type for workspace pages.
 * Includes all data needed for layout rendering.
 *
 * Note: organizations and workspaces lists are NOT included - they are lazy-loaded
 * in switcher dropdowns only when needed.
 */
export type TWorkspaceLayoutData = {
  session: Session;
  user: TUser;
  workspace: TWorkspace; // Current workspace with full details
  organization: TOrganization;
  membership: TMembership;
  isAccessControlAllowed: boolean;
  isUnifyFeedbackAllowed: boolean;
  isFeedbackDirectoriesAllowed: boolean;
  isDashboardsAllowed: boolean;
  workspacePermission: TTeamPermission | null;
  license: TEnterpriseLicense;
  responseCount: number;
};
