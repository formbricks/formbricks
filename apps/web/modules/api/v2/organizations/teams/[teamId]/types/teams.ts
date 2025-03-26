import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";
import { ZTeam } from "@formbricks/database/zod/teams";

extendZodWithOpenApi(z);

export const teamIdSchema = z
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

export const teamUpdateSchema = ZTeam.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  organizationId: true,
}).openapi({
  ref: "teamUpdate",
  description: "A team to update.",
});
