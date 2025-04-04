import { ZGetFilter } from "@/modules/api/v2/types/api-filter";
import { z } from "zod";
import { ZUser } from "@formbricks/database/zod/users";

export const ZGetUsersFilter = ZGetFilter.extend({
  id: z.string().optional(),
  email: z.string().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      return false;
    }
    return true;
  },
  {
    message: "startDate must be before endDate",
  }
);

export type TGetUsersFilter = z.infer<typeof ZGetUsersFilter>;

export const ZUserInput = ZUser.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export type TUserInput = z.infer<typeof ZUserInput>;

export const ZUserInputPatch = ZUserInput.extend({
  // Override specific fields to be optional
  name: ZUser.shape.name.optional(),
  role: ZUser.shape.role.optional(),
  teams: ZUser.shape.teams.optional(),
  isActive: ZUser.shape.isActive.optional(),
});

export type TUserInputPatch = z.infer<typeof ZUserInputPatch>;
