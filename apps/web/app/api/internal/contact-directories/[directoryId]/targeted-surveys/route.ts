import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getContactDirectoryTargetedSurveysOperation } from "../../lib/operations";
import { ZContactDirectoryParams, ZContactDirectoryQuery } from "../../schemas";

/**
 * `GET /api/internal/contact-directories/{directoryId}/targeted-surveys`: for each workspace of the
 * directory, the running app surveys that target contacts, which stop reaching anyone if it is removed.
 * Internal; owners and managers only.
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZContactDirectoryParams, query: ZContactDirectoryQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getContactDirectoryTargetedSurveysOperation({
      authentication,
      directoryId: parsedInput.params.directoryId,
      requestId,
      instance,
    }),
});
