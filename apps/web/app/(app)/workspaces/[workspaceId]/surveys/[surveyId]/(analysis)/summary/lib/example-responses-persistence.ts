import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import {
  type TGeneratedExampleDataset,
  toExampleResponseInput,
} from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/example-responses";
import { createResponseWithQuotaEvaluation } from "@/app/api/v1/client/[workspaceId]/responses/lib/response";

/**
 * The dataset is written inside one interactive transaction, so these bound how long that transaction
 * may wait for a connection and how long it may run. The 20-response dataset issues a few hundred
 * statements; the generous ceiling exists so a slow database turns into a slower success rather than a
 * half-written batch, not because the write is expected to take that long. The LLM call is *not*
 * covered — it has already resolved by the time this runs.
 */
const PERSIST_TRANSACTION_MAX_WAIT_MS = 10_000;
const PERSIST_TRANSACTION_TIMEOUT_MS = 30_000;

export type TPersistExampleResponseDatasetArgs = {
  surveyId: string;
  workspaceId: string;
  dataset: TGeneratedExampleDataset;
};

/**
 * Persists one generated example-response dataset as a single all-or-nothing write.
 *
 * Every row the dataset produces — the tag, each response's Display, the Response itself, its tag
 * link, its backdated `createdAt`, and the impression-only Displays — is written through one
 * transaction. A failure part-way through therefore leaves no synthetic rows behind, and the survey
 * stays eligible for another generation attempt instead of tripping the zero-response guard on a
 * partial batch (ENG-2147).
 *
 * `Response` children (`TagsOnResponses`, `ResponseQuotaLink`) cascade, so the rollback needs no
 * cleanup of its own. Synthetic responses never contain file uploads — no upload element type is
 * synthesizable — so there is nothing in object storage to unwind either.
 */
export const persistExampleResponseDataset = async ({
  surveyId,
  workspaceId,
  dataset,
}: TPersistExampleResponseDatasetArgs): Promise<{ createdCount: number }> => {
  await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // Tag every synthetic response so users can tell them apart from real ones in the responses
      // list. Upsert handles the case where a previous run (or a user) already created the tag in
      // this workspace; when this attempt creates it, the rollback takes it with them.
      const aiTag = await tx.tag.upsert({
        where: { workspaceId_name: { workspaceId, name: dataset.tagName } },
        create: { workspaceId, name: dataset.tagName },
        update: {},
        select: { id: true },
      });

      for (const item of dataset.responses) {
        // Each response gets its own Display so the dashboard's "displays" count and completion-rate
        // calc line up with the response row. Backdate the display to the same moment as the response
        // — the assertDisplayOwnership check inside createResponse runs against the matching surveyId.
        const display = await tx.display.create({
          data: { survey: { connect: { id: surveyId } }, createdAt: item.createdAt },
          select: { id: true },
        });

        const response = await createResponseWithQuotaEvaluation(
          toExampleResponseInput(surveyId, workspaceId, item, display.id),
          tx
        );

        await tx.tagsOnResponses.create({ data: { responseId: response.id, tagId: aiTag.id } });

        // `createResponse` ignores caller-supplied createdAt; backdate after the fact so the
        // responses-over-time chart shows a realistic spread.
        await tx.response.update({
          where: { id: response.id },
          data: { createdAt: item.createdAt },
        });
      }

      // Extra view-only displays simulate respondents who saw the survey but didn't submit. Without
      // these the completion rate would read 100%.
      if (dataset.displays.length > 0) {
        await tx.display.createMany({
          data: dataset.displays.map(({ createdAt }) => ({ surveyId, createdAt })),
        });
      }
    },
    { maxWait: PERSIST_TRANSACTION_MAX_WAIT_MS, timeout: PERSIST_TRANSACTION_TIMEOUT_MS }
  );

  return { createdCount: dataset.responses.length };
};
