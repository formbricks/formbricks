import { z } from "zod";
import type { Team } from "../src/prisma";

export const ZTeam = z.object({
  id: z.cuid2().describe("The ID of the team"),
  createdAt: z.coerce
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("The date and time the team was created"),
  updatedAt: z.coerce
    .date()
    .meta({
      example: "2021-01-01T00:00:00.000Z",
    })
    .describe("The date and time the team was last updated"),
  name: z
    .string()
    .meta({
      example: "My team",
    })
    .describe("The name of the team"),
  organizationId: z.cuid2().describe("The ID of the organization"),
  // `dashboardLimited` is internal to Dashboard Access Control (ADR-0060) and stays out of the v2 shape.
}) satisfies z.ZodType<Omit<Team, "dashboardLimited">>;

ZTeam.meta({
  id: "team",
}).describe("A team");
