import { z } from "zod";
import { ZResponse } from "@formbricks/database/zod/responses";

export const responseIdSchema = z
  .string()
  .cuid2()
  .openapi({
    ref: "responseId",
    description: "The ID of the response",
    param: {
      name: "id",
      in: "path",
    },
  });

export const responseUpdateSchema = ZResponse.omit({
  id: true,
}).openapi({
  ref: "responseUpdate",
  description: "A response to update.",
});
