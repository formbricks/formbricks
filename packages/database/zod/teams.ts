import type { Team } from "@prisma/client";
import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";

extendZodWithOpenApi(z);

export const ZTeam = z.object({
  id: z.string().cuid2().openapi({
    description: "The ID of the response",
  }),
  createdAt: z.coerce.date().openapi({
    description: "The date and time the response was created",
    example: "2021-01-01T00:00:00.000Z",
  }),
  updatedAt: z.coerce.date().openapi({
    description: "The date and time the response was last updated",
    example: "2021-01-01T00:00:00.000Z",
  }),
  name: z.string().openapi({
    description: "The name of the team",
    example: "My team",
  }),
  organizationId: z.string().cuid2().openapi({
    description: "The ID of the organization",
  }),
}) satisfies z.ZodType<Team>;

ZTeam.openapi({
  ref: "team",
  description: "A team",
});
