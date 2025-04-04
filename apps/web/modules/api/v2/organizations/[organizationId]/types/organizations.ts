import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";

extendZodWithOpenApi(z);

export const organizationIdSchema = z
  .string()
  .cuid2()
  .openapi({
    ref: "organizationId",
    description: "The ID of the organization",
    param: {
      name: "organizationId",
      in: "path",
    },
  });
