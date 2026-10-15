import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { problemNotFound } from "@/app/api/v3/lib/response";
import { getSlackChannelsOperation } from "../../lib/operations";
import { ZIntegrationParams, ZIntegrationWorkspaceQuery } from "../../schemas";

/** `GET /api/internal/integrations/slack/channels?workspaceId=`: the channels a mapping can post to. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZIntegrationParams, query: ZIntegrationWorkspaceQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    parsedInput.params.type === "slack"
      ? getSlackChannelsOperation({
          authentication,
          workspaceId: parsedInput.query.workspaceId,
          requestId,
          instance,
        })
      : problemNotFound(requestId, "Channels", parsedInput.params.type, instance),
});
