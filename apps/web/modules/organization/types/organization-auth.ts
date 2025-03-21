import { z } from "zod";
import { ZMembership } from "@formbricks/types/memberships";
import { ZOrganization } from "@formbricks/types/organizations";
import { ZUser } from "@formbricks/types/user";

export const ZOrganizationAuth = z.object({
  organization: ZOrganization,
  session: z.object({
    user: ZUser.pick({ id: true }),
    expires: z.string(),
  }),
  currentUserMembership: ZMembership,
  isMember: z.boolean(),
  isOwner: z.boolean(),
  isManager: z.boolean(),
  isBilling: z.boolean(),
});

export type TOrganizationAuth = z.infer<typeof ZOrganizationAuth>;
