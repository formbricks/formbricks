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

// `outcome` is a reviewer's verdict, set through the v3 batch-outcome route. It stays out of this
// full-replace body: required, it would reject every PUT written before the field existed, and accepted,
// a `null` in a replayed body would silently clear a verdict. The route strips it before the write.
export const ZResponseUpdateSchema = ZResponse.omit({
  id: true,
  surveyId: true,
  outcome: true,
}).meta({
  id: "responseUpdate",
  description: "A response to update.",
});
