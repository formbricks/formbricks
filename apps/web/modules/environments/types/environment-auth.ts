import { Session } from "next-auth";
import { z } from "zod";
import { TEnvironment, ZEnvironment } from "@formbricks/types/environment";
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

export const ZEnvironmentAuth = z.object({
  environment: ZEnvironment,
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

export type TEnvironmentAuth = z.infer<typeof ZEnvironmentAuth>;

/**
 * Complete layout data type for environment pages.
 * Includes all data needed for layout rendering.
 *
 * Note: organizations and workspaces lists are NOT included - they are lazy-loaded
 * in switcher dropdowns only when needed.
 */
export type TEnvironmentLayoutData = {
  session: Session;
  user: TUser;
  environment: TEnvironment;
  workspace: TWorkspace; // Current workspace with full details
  organization: TOrganization;
  environments: TEnvironment[]; // All workspace environments for switcher
  membership: TMembership;
  isAccessControlAllowed: boolean;
  workspacePermission: TTeamPermission | null;
  license: TEnterpriseLicense;
  responseCount: number;
};
