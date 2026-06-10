import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { validateV3Survey } from "../lib/operations";
import { ZV3EmptyQuery } from "../schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  schemas: {
    body: z.unknown(),
    query: ZV3EmptyQuery,
  },
  handler: async ({ parsedInput, authentication, requestId, instance }) => {
    return await validateV3Survey({
      body: parsedInput.body,
      authentication,
      requestId,
      instance,
    });
  },
});
