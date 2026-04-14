import { z } from "zod";

export const ZOrganizationIdSchema = z
  .cuid2()
  .meta({
    id: "organizationId",
    param: {
      name: "organizationId",
      in: "path",
    },
  })
  .describe("The ID of the organization");
