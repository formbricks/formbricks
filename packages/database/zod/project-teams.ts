import { type ProjectTeam, ProjectTeamPermission } from "@prisma/client";
import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";

extendZodWithOpenApi(z);

export const ZProjectTeam = z.object({
  createdAt: z.coerce.date().openapi({
    description: "The date and time the response was created",
    example: "2021-01-01T00:00:00.000Z",
  }),
  updatedAt: z.coerce.date().openapi({
    description: "The date and time the response was last updated",
    example: "2021-01-01T00:00:00.000Z",
  }),
  projectId: z.string().cuid2().openapi({
    description: "The ID of the project",
  }),
  teamId: z.string().cuid2().openapi({
    description: "The ID of the team",
  }),
  permission: z.nativeEnum(ProjectTeamPermission).openapi({
    description: "Level of access granted to the project",
  }),
}) satisfies z.ZodType<ProjectTeam>;

ZProjectTeam.openapi({
  ref: "projectTeam",
  description: "A relationship between a project and a team with associated permissions",
});
