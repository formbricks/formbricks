import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createTagOperation } from "./lib/operations";
import { ZCreateTagBody } from "./schemas";

/**
 * `POST /api/internal/tags`: create a tag in the workspace the body names, from the response card's tag
 * picker. Listing tags is `GET /api/v3/tags`, which the tags settings page also reads.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { body: ZCreateTagBody },
  action: "created",
  targetType: "tag",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createTagOperation({ authentication, body: parsedInput.body, requestId, instance, auditLog }),
});
