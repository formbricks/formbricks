import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";

extendZodWithOpenApi(z);

export const ZContactAttributeKeyIdSchema = z
  .string()
  .cuid2()
  .openapi({
    ref: "contactAttributeKeyId",
    description: "The ID of the contact attribute key",
    param: {
      name: "id",
      in: "path",
    },
  });
