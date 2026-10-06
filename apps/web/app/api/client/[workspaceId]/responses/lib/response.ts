import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import type { TContactAttributes } from "@formbricks/types/contact-attribute";
import type { TIngestFlag } from "@formbricks/types/embedded-data-ingest";
import type { TResponse } from "@formbricks/types/responses";
import type { TTag } from "@formbricks/types/tags";
import { normalizeResponseLanguage } from "@/lib/response/utils";
import {
  type TQuotaEvaluationContext,
  evaluateResponseQuotas,
  loadQuotaEvaluationContext,
} from "@/modules/ee/quotas/lib/evaluation-service";

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
 * What a create reads before its transaction opens: the workspace's organization (checked to exist)
 * and the contact the response links to. These go through the root client, so reading them inside the
 * transaction would check out a second pool connection while the transaction holds the first, and on a
 * saturated pool that read queues behind the very transaction waiting for it (ENG-3285).
 */
export type TClientResponseCreateContext = {
  contact: { id: string; attributes: TContactAttributes } | null;
};

/** The two halves of a versioned client create: root-client reads, then the transactional write. */
export type TClientResponseWriter<TInput> = {
  resolveContext: (responseInput: TInput) => Promise<TClientResponseCreateContext>;
  createResponse: (
    responseInput: TInput,
    context: TClientResponseCreateContext,
    tx: Prisma.TransactionClient,
    ingestFlags?: readonly TIngestFlag[]
  ) => Promise<TResponse>;
};

/** A caller-owned transaction plus everything that had to be read before it opened. */
export type TCreateResponseTxContext = {
  tx: Prisma.TransactionClient;
  quotaContext: TQuotaEvaluationContext | null;
  responseContext: TClientResponseCreateContext;
};

/**
 * `ingestFlags` rides alongside the parsed input rather than inside it: the server computes them from
 * the incoming data (ENG-1845) and a client-sent list could claim "no flags", which is the same trust
 * problem as the client's filtering. See `buildPrismaResponseData`.
 */
export const createResponseWithQuotaEvaluation = async <TInput extends TQuotaEvaluationResponseInput>(
  responseInput: TInput,
  { resolveContext, createResponse }: TClientResponseWriter<TInput>,
  ingestFlags?: readonly TIngestFlag[],
  // Callers that persist a response as part of a larger all-or-nothing write pass their own
  // transaction so the response and their surrounding rows share one commit. Prisma has no nested
  // interactive transactions, so opening a second one here would commit independently — the caller's
  // rollback would then leave the response behind. Omitted by the request paths, which own a single
  // response each and get their own transaction below. The quota and response contexts come with it
  // because both must be read before that transaction opened.
  txContext?: TCreateResponseTxContext
) => {
  // Canonicalize once so quota evaluation uses the same code persisted on the response (createResponse
  // canonicalizes the stored value via the same helper). Keeps a request internally consistent.
  const canonicalLanguage = normalizeResponseLanguage(responseInput.language) ?? undefined;

  const create = async (
    txClient: Prisma.TransactionClient,
    quotaContext: TQuotaEvaluationContext | null,
    responseContext: TClientResponseCreateContext
  ) => {
    const response = await createResponse(responseInput, responseContext, txClient, ingestFlags);

    const quotaResult = await evaluateResponseQuotas({
      surveyId: response.surveyId,
      responseId: response.id,
      data: responseInput.data,
      variables: responseInput.variables,
      language: canonicalLanguage,
      responseFinished: response.finished,
      // The row just written, so `reserved` quota operands resolve (ENG-1840).
      response,
      tx: txClient,
      quotaContext,
    });

    return {
      ...response,
      ...(quotaResult.quotaFull && { quotaFull: quotaResult.quotaFull }),
    };
  };

  if (txContext) {
    return await create(txContext.tx, txContext.quotaContext, txContext.responseContext);
  }

  // Independent reads, so in parallel. The quota load never rejects (it logs and returns null), so a
  // rejected context read leaves nothing unhandled behind it.
  const [responseContext, quotaContext] = await Promise.all([
    resolveContext(responseInput),
    loadQuotaEvaluationContext(responseInput.surveyId),
  ]);
  return await prisma.$transaction((txClient) => create(txClient, quotaContext, responseContext));
};
