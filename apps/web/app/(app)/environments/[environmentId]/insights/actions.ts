"use server";

import { embed, generateText } from "ai";
import { z } from "zod";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { embeddingsModel, llmModel } from "@formbricks/lib/ai";
import { findNearestDocuments, getDocumentsByTypeAndReferenceId } from "@formbricks/lib/document/service";
import { getQuestionResponseReferenceId } from "@formbricks/lib/document/utils";
import { getOrganizationIdFromEnvironmentId } from "@formbricks/lib/organization/utils";
import { ZId } from "@formbricks/types/environment";

const ZSearchDocuments = z.object({
  environmentId: ZId,
  searchTerm: z.string(),
});

export const searchDocumentsAction = authenticatedActionClient
  .schema(ZSearchDocuments)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: await getOrganizationIdFromEnvironmentId(parsedInput.environmentId),
      rules: ["environment", "read"],
    });

    const { text } = await generateText({
      model: llmModel,
      prompt: `Generate 4 example survey feedback responses from users in one line, separated by comma for the following topic: ${parsedInput.searchTerm}`,
    });

    const { embedding } = await embed({
      model: embeddingsModel,
      value: text,
    });

    const documents = findNearestDocuments(parsedInput.environmentId, embedding, 10);

    return documents;
  });
