import { createResponseWithQuotaEvaluation } from "./__mocks__/example-response-create.mock";
import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { type TResponseWithQuotaFull } from "@formbricks/types/quota";
import { EXAMPLE_AI_GENERATED_TAG_NAME, type TGeneratedExampleDataset } from "./example-responses";
import { persistExampleResponseDataset } from "./example-responses-persistence";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/service", () => ({ generateOrganizationAIObject: vi.fn() }));

const surveyId = "survey_1";
const workspaceId = "workspace_1";
const tagId = "tag_1";

/**
 * Stand-in for the interactive transaction client, holding only the writes the persistence path
 * issues. The spec asserts against this object rather than the base client because that distinction
 * *is* the fix: every row of a dataset has to be written through one transaction, so a failure
 * part-way through rolls the whole batch back (ENG-2147).
 */
const buildTxClient = () => ({
  tag: { upsert: vi.fn().mockResolvedValue({ id: tagId }) },
  display: {
    create: vi.fn(),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  tagsOnResponses: { create: vi.fn().mockResolvedValue(undefined) },
  response: { update: vi.fn().mockResolvedValue(undefined) },
});

type TxClient = ReturnType<typeof buildTxClient>;

let tx: TxClient;

/** Runs the persistence callback against `tx`, the way `prisma.$transaction` would. */
const runTransactionAgainstTx = () => {
  vi.mocked(prisma.$transaction).mockImplementation((callback: unknown) =>
    (callback as (client: Prisma.TransactionClient) => Promise<unknown>)(
      tx as unknown as Prisma.TransactionClient
    )
  );
};

const responseAt = (isoDate: string) => ({
  data: { element_1: "an answer" },
  ttc: { element_1: 4000 },
  finished: true,
  endingId: "ending_1",
  language: null,
  meta: { source: "example-generation" },
  createdAt: new Date(isoDate),
});

const buildDataset = (responseCount: number, impressionCount: number): TGeneratedExampleDataset => ({
  responses: Array.from({ length: responseCount }, (_, index) =>
    responseAt(`2026-08-0${index + 1}T10:00:00.000Z`)
  ),
  displays: Array.from({ length: impressionCount }, (_, index) => ({
    createdAt: new Date(`2026-08-1${index}T10:00:00.000Z`),
  })),
  tagName: EXAMPLE_AI_GENERATED_TAG_NAME,
});

/** A created response, shaped down to the one field the persistence path reads back. */
const createdResponse = (id: string) => ({ id }) as unknown as TResponseWithQuotaFull;

beforeEach(() => {
  tx = buildTxClient();
  runTransactionAgainstTx();
  createResponseWithQuotaEvaluation.mockReset();
  let responseIndex = 0;
  tx.display.create.mockImplementation(() => Promise.resolve({ id: `display_${responseIndex}` }));
  createResponseWithQuotaEvaluation.mockImplementation(() => {
    responseIndex += 1;
    return Promise.resolve(createdResponse(`response_${responseIndex}`));
  });
});

describe("persistExampleResponseDataset", () => {
  describe("Happy Path", () => {
    test("writes the tag, every response's display, tag link and backdated createdAt, and the impression-only displays", async () => {
      const dataset = buildDataset(3, 2);

      const result = await persistExampleResponseDataset({ surveyId, workspaceId, dataset });

      expect(result).toEqual({ createdCount: 3 });
      expect(tx.tag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId_name: { workspaceId, name: EXAMPLE_AI_GENERATED_TAG_NAME } },
        })
      );
      expect(tx.display.create).toHaveBeenCalledTimes(3);
      expect(createResponseWithQuotaEvaluation).toHaveBeenCalledTimes(3);
      expect(tx.tagsOnResponses.create).toHaveBeenCalledTimes(3);
      expect(tx.response.update).toHaveBeenCalledTimes(3);

      // Each response is backdated to its own generated timestamp, not to "now".
      expect(tx.response.update).toHaveBeenNthCalledWith(1, {
        where: { id: "response_1" },
        data: { createdAt: dataset.responses[0].createdAt },
      });
      expect(tx.tagsOnResponses.create).toHaveBeenNthCalledWith(1, {
        data: { responseId: "response_1", tagId },
      });
      expect(tx.display.createMany).toHaveBeenCalledWith({
        data: [
          { surveyId, createdAt: dataset.displays[0].createdAt },
          { surveyId, createdAt: dataset.displays[1].createdAt },
        ],
      });
    });

    test("skips the impression-only display write when the dataset has none", async () => {
      await persistExampleResponseDataset({
        surveyId,
        workspaceId,
        dataset: buildDataset(1, 0),
      });

      expect(tx.display.createMany).not.toHaveBeenCalled();
    });

    test("persists every row through the caller's transaction, never the base client", async () => {
      await persistExampleResponseDataset({ surveyId, workspaceId, dataset: buildDataset(2, 1) });

      // The pre-fix path committed each of these independently on the base client, which is what let a
      // late failure leave the earlier rows behind.
      expect(prisma.tag.upsert).not.toHaveBeenCalled();
      expect(prisma.display.create).not.toHaveBeenCalled();
      expect(prisma.display.createMany).not.toHaveBeenCalled();
      expect(prisma.tagsOnResponses.create).not.toHaveBeenCalled();
      expect(prisma.response.update).not.toHaveBeenCalled();

      // The response write shares the same transaction, so a rollback takes it with the rest. The
      // transaction is the third argument — ingest flags sit in front of it, and are absent here.
      for (const call of createResponseWithQuotaEvaluation.mock.calls) {
        expect(call[1]).toBeUndefined();
        expect(call[2]).toBe(tx);
      }
    });
  });

  describe("Partial-batch failure", () => {
    test("propagates a mid-batch response failure without writing the impression-only displays", async () => {
      const failure = new Error("INJECTED_RESPONSE_3_FAILURE");
      let call = 0;
      createResponseWithQuotaEvaluation.mockImplementation(() => {
        call += 1;
        if (call === 3) return Promise.reject(failure);
        return Promise.resolve(createdResponse(`response_${call}`));
      });

      await expect(
        persistExampleResponseDataset({ surveyId, workspaceId, dataset: buildDataset(4, 2) })
      ).rejects.toThrow(failure);

      // Everything the failed attempt wrote went through the transaction the rejection aborts, and the
      // batch stops at the failure rather than finishing the remaining rows.
      expect(tx.display.create).toHaveBeenCalledTimes(3);
      expect(tx.tagsOnResponses.create).toHaveBeenCalledTimes(2);
      expect(tx.response.update).toHaveBeenCalledTimes(2);
      expect(tx.display.createMany).not.toHaveBeenCalled();
    });

    test("propagates a failure on the tag upsert before any response is written", async () => {
      const failure = new Error("INJECTED_TAG_FAILURE");
      tx.tag.upsert.mockRejectedValue(failure);

      await expect(
        persistExampleResponseDataset({ surveyId, workspaceId, dataset: buildDataset(2, 1) })
      ).rejects.toThrow(failure);

      expect(tx.display.create).not.toHaveBeenCalled();
      expect(createResponseWithQuotaEvaluation).not.toHaveBeenCalled();
    });
  });
});
