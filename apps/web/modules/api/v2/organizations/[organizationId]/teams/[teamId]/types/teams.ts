import { z } from "zod";
import { ZTeam } from "@formbricks/database/zod/teams";

export const ZTeamIdSchema = z
  .cuid2()
  .meta({
    id: "teamId",
    param: {
      name: "id",
      in: "path",
    },
  })
  .describe("The ID of the team");

export const ZTeamUpdateSchema = ZTeam.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  organizationId: true,
});
