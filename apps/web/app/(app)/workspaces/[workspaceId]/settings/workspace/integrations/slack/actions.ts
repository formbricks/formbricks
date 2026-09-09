"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { assertCan } from "@/lib/authorization";
import { getSlackChannels } from "@/lib/slack/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";

const ZGetSlackChannelsAction = z.object({
  workspaceId: ZId,
});

export const getSlackChannelsAction = authenticatedActionClient
  .inputSchema(ZGetSlackChannelsAction)
  .action(async ({ ctx, parsedInput }) => {
    await assertCan({ type: "user", id: ctx.user.id }, "workspace.write", {
      type: "workspace",
      id: parsedInput.workspaceId,
    });

    return await getSlackChannels(parsedInput.workspaceId);
  });
