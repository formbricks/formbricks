import { z } from "zod";
import { ZResponse } from "@formbricks/database/zod/responses";

export const ZResponseIdSchema = z
  .cuid2()
  .meta({
    id: "responseId",
    param: {
      name: "id",
      in: "path",
    },
  })
  .describe("The ID of the response");

export const ZResponseUpdateSchema = ZResponse.omit({
  id: true,
  surveyId: true,
}).meta({
  id: "responseUpdate",
  description: "A response to update.",
});
