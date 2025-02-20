import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";

extendZodWithOpenApi(z);

export const surveyIdSchema = z
  .string()
  .cuid2()
  .openapi({
    ref: "surveyId",
    description: "The ID of the survey",
    param: {
      name: "id",
      in: "path",
    },
  });
