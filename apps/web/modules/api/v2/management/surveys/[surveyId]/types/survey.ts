import { z } from "zod";

export const surveyIdSchema = z
  .cuid2()
  .meta({
    id: "surveyId",
    param: {
      name: "id",
      in: "path",
    },
  })
  .describe("The ID of the survey");
