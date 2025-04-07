import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";
import { ZTeam } from "@formbricks/database/zod/teams";

extendZodWithOpenApi(z);

export const ZTeamIdSchema = z
  .string()
  .cuid2()
  .openapi({
    ref: "teamId",
    description: "The ID of the team",
    param: {
      name: "id",
      in: "path",
    },
  });

export const ZTeamUpdateSchema = ZTeam.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  organizationId: true,
});
