import { type ProjectTeam, ProjectTeamPermission } from "@prisma/client";
import { z } from "zod";

export const ZProjectTeam = z.object({
  createdAt: z.coerce
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("The date and time the project tem was created"),
  updatedAt: z.coerce
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("The date and time the project team was last updated"),
  projectId: z.cuid2().describe("The ID of the project"),
  teamId: z.cuid2().describe("The ID of the team"),
  permission: z.enum(ProjectTeamPermission).describe("Level of access granted to the project"),
}) satisfies z.ZodType<ProjectTeam>;

ZProjectTeam.meta({
  id: "projectTeam",
}).describe("A relationship between a project and a team with associated permissions");
