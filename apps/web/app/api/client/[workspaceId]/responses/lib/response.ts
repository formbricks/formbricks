import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import type { TContactAttributes } from "@formbricks/types/contact-attribute";
import type { TIngestFlag } from "@formbricks/types/embedded-data-ingest";
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

/**
 * `ingestFlags` rides alongside the parsed input rather than inside it: the server computes them from
 * the incoming data (ENG-1845) and a client-sent list could claim "no flags", which is the same trust
 * problem as the client's filtering. See `buildPrismaResponseData`.
 */
export const createResponseWithQuotaEvaluation = async <TInput extends TQuotaEvaluationResponseInput>(
  responseInput: TInput,
  createResponse: (
    responseInput: TInput,
    tx: Prisma.TransactionClient,
    ingestFlags?: readonly TIngestFlag[]
  ) => Promise<TResponse>,
  ingestFlags?: readonly TIngestFlag[],
  // Callers that persist a response as part of a larger all-or-nothing write pass their own
  // transaction so the response and their surrounding rows share one commit. Prisma has no nested
  // interactive transactions, so opening a second one here would commit independently — the caller's
  // rollback would then leave the response behind. Omitted by the request paths, which own a single
  // response each and get their own transaction below.
  tx?: Prisma.TransactionClient
) => {
  // Canonicalize once so quota evaluation uses the same code persisted on the response (createResponse
  // canonicalizes the stored value via the same helper). Keeps a request internally consistent.
  const canonicalLanguage = normalizeResponseLanguage(responseInput.language) ?? undefined;

  const create = async (txClient: Prisma.TransactionClient) => {
    const response = await createResponse(responseInput, txClient, ingestFlags);

    const quotaResult = await evaluateResponseQuotas({
      surveyId: responseInput.surveyId,
      responseId: response.id,
      data: responseInput.data,
      variables: responseInput.variables,
      language: canonicalLanguage,
      responseFinished: response.finished,
      // The row just written, so `reserved` quota operands resolve (ENG-1840).
      response,
      tx: txClient,
    });

    return {
      ...response,
      ...(quotaResult.quotaFull && { quotaFull: quotaResult.quotaFull }),
    };
  };

  if (tx) {
    return await create(tx);
  }

  return await prisma.$transaction(create);
};
