import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";
import { ZResponse } from "@formbricks/database/zod/responses";

extendZodWithOpenApi(z);

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
  surveyId: true,
}).openapi({
  ref: "responseUpdate",
  description: "A response to update.",
});
