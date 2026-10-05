import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { validateCustomCss } from "./lib/operations";
import { ZCustomCssValidation } from "./schemas";

// An authenticated dashboard utility, not a new public v3 contract. Use the shared wrapper for
// session auth, bounded request parsing, rate limiting and problem responses.
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { body: ZCustomCssValidation },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    validateCustomCss({ authentication, input: parsedInput.body, requestId, instance }),
});
