"use server";

import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { getDocumentsByInsightId } from "@formbricks/lib/document/service";
import { getOrganizationIdFromInsightId } from "@formbricks/lib/organization/utils";
import { ZId } from "@formbricks/types/common";

const ZGetDocumentsByInsightIdAction = z.object({
  insightId: ZId,
});

export const getDocumentsByInsightIdAction = authenticatedActionClient
  .schema(ZGetDocumentsByInsightIdAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromInsightId(parsedInput.insightId),
      rules: ["survey", "read"],
    });

    return await getDocumentsByInsightId(parsedInput.insightId);
  });
