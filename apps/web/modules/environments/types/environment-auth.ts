import { ZTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { z } from "zod";
import { ZEnvironment } from "@formbricks/types/environment";
import { ZMembership } from "@formbricks/types/memberships";
import { ZOrganization } from "@formbricks/types/organizations";
import { ZProject } from "@formbricks/types/project";
import { ZUser } from "@formbricks/types/user";

export const ZEnvironmentAuth = z.object({
  environment: ZEnvironment,
  project: ZProject,
  organization: ZOrganization,
  session: z.object({
    user: ZUser.pick({ id: true }),
    expires: z.string(),
  }),
  currentUserMembership: ZMembership,
  projectPermission: ZTeamPermission.nullable(),
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
