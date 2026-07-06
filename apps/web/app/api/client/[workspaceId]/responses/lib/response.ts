import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import type { TContactAttributes } from "@formbricks/types/contact-attribute";
import type { TResponse } from "@formbricks/types/responses";
import type { TTag } from "@formbricks/types/tags";
import { normalizeResponseLanguage } from "@/lib/response/utils";
import { evaluateResponseQuotas } from "@/modules/ee/quotas/lib/evaluation-service";

type TQuotaEvaluationResponseInput = {
  surveyId: string;
  data: TResponse["data"];
  variables?: TResponse["variables"];
  language?: string;
};

export const buildClientResponse = (
  responsePrisma: Omit<TResponse, "contact" | "tags"> & { tags: { tag: TTag }[] },
  contact: { id: string; attributes: TContactAttributes } | null
): TResponse => ({
  ...responsePrisma,
  contact: contact
    ? {
        id: contact.id,
        userId: contact.attributes.userId,
      }
    : null,
  tags: responsePrisma.tags.map((tagPrisma: { tag: TTag }) => tagPrisma.tag),
});

export const createResponseWithQuotaEvaluation = async <TInput extends TQuotaEvaluationResponseInput>(
  responseInput: TInput,
  createResponse: (responseInput: TInput, tx: Prisma.TransactionClient) => Promise<TResponse>
) => {
  // Canonicalize once so quota evaluation uses the same code persisted on the response (createResponse
  // canonicalizes the stored value via the same helper). Keeps a request internally consistent.
  const canonicalLanguage = normalizeResponseLanguage(responseInput.language) ?? undefined;
  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const response = await createResponse(responseInput, tx);

    const quotaResult = await evaluateResponseQuotas({
      surveyId: responseInput.surveyId,
      responseId: response.id,
      data: responseInput.data,
      variables: responseInput.variables,
      language: canonicalLanguage,
      responseFinished: response.finished,
      tx,
    });

    return {
      ...response,
      ...(quotaResult.quotaFull && { quotaFull: quotaResult.quotaFull }),
    };
  });
};
