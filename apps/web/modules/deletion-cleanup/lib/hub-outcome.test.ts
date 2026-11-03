import { prisma } from "@/lib/__mocks__/database";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CLEANUP_SETTLE_MS } from "./constants";
import { type TOutcomeCleanupRow, reconcileResponseOutcomes } from "./hub-outcome";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/env", () => ({ env: { HUB_API_KEY: "hub-key", HUB_API_URL: "http://hub.test" } }));
vi.mock("@/lib/survey/service", () => ({ getSurvey: vi.fn() }));
// The select and the row-to-response mapping are the response service's; the rows below are already responses.
vi.mock("@/lib/response/service", () => ({
  responseSelection: {},
  mapResponsePrismaToResponse: (row: unknown) => row,
}));
vi.mock("@/lib/feedback-source/service", () => ({
  getFeedbackSourcesBySurveyId: vi.fn(),
  updateFeedbackSource: vi.fn(),
}));
// The Hub boundary: every call the job makes to the Hub goes through these four.
vi.mock("@/modules/hub/service", () => ({
  createFeedbackRecordsBatch: vi.fn(),
  listFeedbackRecords: vi.fn(),
  updateFeedbackRecord: vi.fn(),
  deleteFeedbackRecord: vi.fn(),
}));

const { getSurvey } = await import("@/lib/survey/service");
const { getFeedbackSourcesBySurveyId } = await import("@/lib/feedback-source/service");
const { logger } = await import("@formbricks/logger");
const { createFeedbackRecordsBatch, listFeedbackRecords, updateFeedbackRecord, deleteFeedbackRecord } =
  await import("@/modules/hub/service");

/**
 * The reconcile job with the Hub replaced by call-recording mocks at `modules/hub/service.ts`; only the
 * database reads are faked besides. What this proves is the job's decisions and the Hub calls they produce
 * (which calls, with what arguments, in which order). It does not prove the SQL of the queue (see the
 * integration test) or the behaviour of the real Hub service.
 */

const TENANT = "dir-1";
const SURVEY = "survey-1";
const NOW = new Date("2030-01-10T10:00:00.000Z");

type TRow = {
  id: string;
  outcome: "lowQuality" | null;
  finished: boolean;
  surveyId: string;
  data: Record<string, unknown>;
};

let responses: Map<string, TRow>;

const survey = (overrides: Record<string, unknown> = {}) => ({
  id: SURVEY,
  name: "Product Feedback",
  type: "link",
  languages: [],
  visibility: "workspace",
  visibilityProjectedVersion: 1,
  visibilityVersion: 1,
  blocks: [
    {
      id: "b1",
      name: "Block",
      elements: [
        { id: "el-text", type: "openText", headline: { default: "How can we improve?" } },
        { id: "el-nps", type: "nps", headline: { default: "How likely to recommend?" } },
      ],
    },
  ],
  ...overrides,
});

const source = (overrides: Record<string, unknown> = {}) => ({
  id: "source-1",
  type: "formbricks_survey",
  status: "active",
  feedbackDirectoryId: TENANT,
  formbricksMappings: [
    { id: "m1", surveyId: SURVEY, elementId: "el-text", hubFieldType: "text", customFieldLabel: null },
    { id: "m2", surveyId: SURVEY, elementId: "el-nps", hubFieldType: "nps", customFieldLabel: null },
  ],
  ...overrides,
});

const addResponse = (id: string, overrides: Partial<TRow> = {}): TRow => {
  const row: TRow = {
    id,
    outcome: null,
    finished: true,
    surveyId: SURVEY,
    data: { "el-text": `answer of ${id}`, "el-nps": 9 },
    ...overrides,
  };
  responses.set(id, row);
  return row;
};

/** The response as the database hands it to the job. */
const dbRow = (row: TRow) => ({
  ...row,
  createdAt: NOW,
  updatedAt: NOW,
  endingId: null,
  meta: {},
  ttc: {},
  variables: {},
  contactAttributes: null,
  singleUseId: null,
  language: "en",
  displayId: null,
  contact: null,
  tags: [],
});

const outcomeRow = (responseId: string, overrides: Partial<TOutcomeCleanupRow> = {}): TOutcomeCleanupRow => ({
  id: `cleanup-${responseId}`,
  tenantIds: [TENANT],
  responseIds: [responseId],
  ...overrides,
});

const budget = (remaining = 100_000) => ({ remaining, deadline: Date.now() + 60_000 });

const hubOk = (data: unknown) => ({ data, error: null }) as never;
const hubError = (status: number, code?: string) =>
  ({ data: null, error: { status, message: `hub ${status}`, detail: "", code } }) as never;

/** A record as the Hub lists it. */
const hubRecord = (id: string, submissionId: string, fieldId = "el-text") => ({
  id,
  tenant_id: TENANT,
  source_type: "formbricks_survey",
  source_id: SURVEY,
  submission_id: submissionId,
  field_id: fieldId,
});

/** The next listings the Hub answers with, one page per call; an empty page once they run out. */
let listPages: unknown[];
const listsNext = (...pages: unknown[][]) => listPages.push(...pages);

/** Every Hub call so far, in the order they were made, e.g. `list`, `delete:h1`, `create:2`. */
const hubCalls = (): string[] =>
  (
    [
      ["list", listFeedbackRecords, () => ""],
      ["delete", deleteFeedbackRecord, (args: unknown[]) => `:${args[0]}`],
      ["update", updateFeedbackRecord, (args: unknown[]) => `:${args[0]}`],
      ["create", createFeedbackRecordsBatch, (args: unknown[]) => `:${(args[0] as unknown[]).length}`],
    ] as const
  )
    .flatMap(([label, fn, detail]) =>
      vi.mocked(fn).mock.calls.map((args, i) => ({
        order: vi.mocked(fn).mock.invocationCallOrder[i],
        text: `${label}${detail(args as unknown[])}`,
      }))
    )
    .sort((a, b) => a.order - b.order)
    .map(({ text }) => text);

/** Every record the job asked the Hub to create, across all calls. */
const createdRecords = () => vi.mocked(createFeedbackRecordsBatch).mock.calls.flatMap(([records]) => records);

const setOutcome = (id: string, outcome: TRow["outcome"]) => {
  (responses.get(id) as TRow).outcome = outcome;
};

const run = async (...rows: TOutcomeCleanupRow[]) => reconcileResponseOutcomes(rows, budget());
const resultOf = (results: Awaited<ReturnType<typeof run>>, row: TOutcomeCleanupRow) => results.get(row.id);

describe("reconcileResponseOutcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    responses = new Map();
    listPages = [];

    vi.mocked(listFeedbackRecords).mockImplementation((async () =>
      hubOk({ data: listPages.shift() ?? [] })) as never);
    vi.mocked(deleteFeedbackRecord).mockResolvedValue(hubOk({ deleted: true }));
    vi.mocked(updateFeedbackRecord).mockResolvedValue(hubOk({ id: "existing" }));
    vi.mocked(createFeedbackRecordsBatch).mockImplementation((async (inputs: unknown[]) => ({
      results: inputs.map(() => hubOk({ id: "created" })),
    })) as never);
    vi.mocked(getSurvey).mockImplementation(async () => survey() as never);
    vi.mocked(getFeedbackSourcesBySurveyId).mockImplementation(async () => [source()] as never);
    vi.mocked(prisma.response.findMany).mockImplementation((async (args: {
      where: { id: { in: string[] } };
    }) =>
      args.where.id.in.flatMap((id) =>
        responses.has(id) ? [dbRow(responses.get(id) as TRow)] : []
      )) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("marking Low quality", () => {
    test("lists only that response's records of the survey, deletes them until a listing is empty, and looks again after the settle time", async () => {
      addResponse("r1", { outcome: "lowQuality" });
      listsNext([hubRecord("h1", "r1"), hubRecord("h2", "r1", "el-nps")]);

      const results = await run(outcomeRow("r1"));

      expect(hubCalls()).toEqual(["list", "delete:h1", "delete:h2", "list"]);
      expect(vi.mocked(listFeedbackRecords).mock.calls[0]?.[0]).toEqual({
        tenant_id: TENANT,
        source_type: ["formbricks_survey"],
        source_id: [SURVEY],
        submission_id: ["r1"],
        limit: 100,
      });
      expect(createdRecords()).toHaveLength(0);
      expect(resultOf(results, outcomeRow("r1"))).toEqual({ status: "again", delayMs: CLEANUP_SETTLE_MS });
    });

    test("a listing that finds nothing is done, and deletes nothing", async () => {
      addResponse("r1", { outcome: "lowQuality" });

      const results = await run(outcomeRow("r1"));

      expect(hubCalls()).toEqual(["list"]);
      expect(resultOf(results, outcomeRow("r1"))).toEqual({ status: "done" });
    });

    test("a record the Hub no longer has (404 on delete) counts as already gone, not as a failure", async () => {
      addResponse("r1", { outcome: "lowQuality" });
      listsNext([hubRecord("h1", "r1")]);
      vi.mocked(deleteFeedbackRecord).mockResolvedValue(hubError(404));

      const results = await run(outcomeRow("r1"));

      expect(resultOf(results, outcomeRow("r1"))).toEqual({ status: "again", delayMs: CLEANUP_SETTLE_MS });
    });

    test("a delete the Hub refuses is a failure to retry", async () => {
      addResponse("r1", { outcome: "lowQuality" });
      listsNext([hubRecord("h1", "r1")]);
      vi.mocked(deleteFeedbackRecord).mockResolvedValue(hubError(500));

      const results = await run(outcomeRow("r1"));

      expect(resultOf(results, outcomeRow("r1"))).toEqual({ status: "failed", error: "hubDelete:500" });
    });

    test("a response deleted in the meantime is left to its own deletion cleanup", async () => {
      const results = await run(outcomeRow("gone"));

      expect(resultOf(results, outcomeRow("gone"))).toEqual({ status: "done" });
      expect(hubCalls()).toEqual([]);
    });
  });

  describe("restoring", () => {
    test("creates the records of every mapped element, and the same ones as the first time", async () => {
      addResponse("r1");
      const first = await run(outcomeRow("r1"));
      const published = createdRecords();
      expect(published).toHaveLength(2);
      expect(published).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tenant_id: TENANT,
            source_type: "formbricks_survey",
            source_id: SURVEY,
            submission_id: "r1",
            field_id: "el-text",
            value_text: "answer of r1",
          }),
          expect.objectContaining({ submission_id: "r1", field_id: "el-nps", value_number: 9 }),
        ])
      );

      // Marked, then restored: the records come back with the values they had.
      setOutcome("r1", "lowQuality");
      listsNext([hubRecord("h1", "r1"), hubRecord("h2", "r1", "el-nps")]);
      await run(outcomeRow("r1"));
      vi.mocked(createFeedbackRecordsBatch).mockClear();
      setOutcome("r1", null);
      const restored = await run(outcomeRow("r1"));

      expect(createdRecords()).toEqual(published);
      expect(first).toEqual(restored);
      expect(resultOf(restored, outcomeRow("r1"))).toEqual({ status: "done" });
    });

    test("a record that is still there (a cleanup that had not run) is corrected in place, in order: create, look up, update", async () => {
      addResponse("r1");
      vi.mocked(createFeedbackRecordsBatch).mockImplementation((async (inputs: unknown[]) => ({
        results: inputs.map(() => hubError(409, "conflict")),
      })) as never);
      vi.mocked(listFeedbackRecords).mockImplementation((async () =>
        hubOk({ data: [{ id: "existing" }] })) as never);

      const results = await run(outcomeRow("r1"));

      expect(hubCalls()).toEqual(["create:2", "list", "list", "update:existing", "update:existing"]);
      expect(vi.mocked(listFeedbackRecords).mock.calls.map(([params]) => params)).toEqual([
        { tenant_id: TENANT, submission_id: ["r1"], field_id: ["el-text"], limit: 1 },
        { tenant_id: TENANT, submission_id: ["r1"], field_id: ["el-nps"], limit: 1 },
      ]);
      expect(resultOf(results, outcomeRow("r1"))).toEqual({ status: "done" });
    });

    test("a create refused with tenant_write_conflict (a purge is running) is a retryable failure, not a duplicate and not an error", async () => {
      addResponse("r1");
      vi.mocked(createFeedbackRecordsBatch).mockImplementation((async (inputs: unknown[]) => ({
        results: inputs.map(() => hubError(409, "tenant_write_conflict")),
      })) as never);

      const results = await run(outcomeRow("r1"));

      expect(resultOf(results, outcomeRow("r1"))).toEqual({ status: "failed", error: "hubReconcile:409" });
      // Nothing was looked up or patched as if the record existed.
      expect(hubCalls()).toEqual(["create:2"]);
      expect(logger.error).not.toHaveBeenCalled();
    });

    test.each([
      ["a response that is not finished", () => addResponse("r1", { finished: false })],
      [
        "a survey that is not workspace-visible",
        () => {
          addResponse("r1");
          vi.mocked(getSurvey).mockImplementation(async () => survey({ visibility: "restricted" }) as never);
        },
      ],
      [
        "a survey with no active feedback source",
        () => {
          addResponse("r1");
          vi.mocked(getFeedbackSourcesBySurveyId).mockImplementation(async () => []);
        },
      ],
    ])("publishes nothing for %s", async (_name, arrange) => {
      arrange();

      const results = await run(outcomeRow("r1"));

      expect(hubCalls()).toEqual([]);
      expect(resultOf(results, outcomeRow("r1"))).toEqual({ status: "done" });
    });
  });

  describe("a quick sequence of changes", () => {
    test("mark, restore, mark: each run does what the outcome is at that moment, and the last one removes", async () => {
      addResponse("r1", { outcome: "lowQuality" });
      listsNext([hubRecord("h1", "r1")]);
      await run(outcomeRow("r1")); // the first mark's row
      expect(hubCalls()).toEqual(["list", "delete:h1", "list"]);
      vi.clearAllMocks();

      setOutcome("r1", null);
      await run(outcomeRow("r1")); // the restore's row (the mark's pending row was cancelled)
      expect(hubCalls()).toEqual(["create:2"]);
      vi.clearAllMocks();

      setOutcome("r1", "lowQuality");
      listsNext([hubRecord("h3", "r1")]);
      await run(outcomeRow("r1")); // the second mark's row

      expect(hubCalls()).toEqual(["list", "delete:h3", "list"]);
    });

    test("a stale mark row run after a restore follows the CURRENT outcome: it rebuilds and deletes nothing", async () => {
      addResponse("r1"); // restored already; the mark's pending row is still there (or runs late)

      await run(outcomeRow("r1"));

      expect(hubCalls()).toEqual(["create:2"]);
    });

    test("a restore that lands while the records are being deleted ends with them rebuilt", async () => {
      addResponse("r1", { outcome: "lowQuality" });
      listsNext([hubRecord("h1", "r1")]);
      // The first Hub delete is where the reviewer restores.
      vi.mocked(deleteFeedbackRecord).mockImplementationOnce((async () => {
        setOutcome("r1", null);
        return hubOk({ deleted: true });
      }) as never);

      const results = await run(outcomeRow("r1"));

      // Re-read after its Hub calls, the job saw the new outcome and rebuilt within the same run.
      expect(hubCalls()).toEqual(["list", "delete:h1", "list", "create:2"]);
      expect(resultOf(results, outcomeRow("r1"))).toEqual({ status: "done" });
    });

    test("a mark that lands while the records are being rebuilt ends with them removed", async () => {
      addResponse("r1");
      vi.mocked(createFeedbackRecordsBatch).mockImplementationOnce((async (inputs: unknown[]) => {
        setOutcome("r1", "lowQuality");
        return { results: inputs.map(() => hubOk({ id: "created" })) };
      }) as never);
      listsNext([hubRecord("h1", "r1"), hubRecord("h2", "r1", "el-nps")]);

      await run(outcomeRow("r1"));

      expect(hubCalls()).toEqual(["create:2", "list", "delete:h1", "delete:h2", "list"]);
    });

    test("an outcome that keeps flipping is left to the next run, not looped on", async () => {
      addResponse("r1", { outcome: "lowQuality" });
      // The reviewer is faster than every pass: each Hub call flips the outcome.
      const flip = () => setOutcome("r1", responses.get("r1")?.outcome ? null : "lowQuality");
      vi.mocked(listFeedbackRecords).mockImplementation((async () => {
        flip();
        return hubOk({ data: [] });
      }) as never);
      vi.mocked(createFeedbackRecordsBatch).mockImplementation((async (inputs: unknown[]) => {
        flip();
        return { results: inputs.map(() => hubOk({ id: "created" })) };
      }) as never);

      const results = await run(outcomeRow("r1"));

      expect(resultOf(results, outcomeRow("r1"))).toEqual({ status: "again", delayMs: 0 });
      expect(hubCalls().length).toBeLessThanOrEqual(3);
    });
  });

  describe("the Hub is down", () => {
    test("a mark's cleanup fails softly, deletes nothing, and a later run finishes it", async () => {
      addResponse("r1", { outcome: "lowQuality" });
      vi.mocked(listFeedbackRecords).mockResolvedValueOnce(hubError(503));

      const down = await run(outcomeRow("r1"));

      expect(resultOf(down, outcomeRow("r1"))).toEqual({ status: "failed", error: "hubList:503" });
      expect(deleteFeedbackRecord).not.toHaveBeenCalled();

      listsNext([hubRecord("h1", "r1")]);
      const later = await run(outcomeRow("r1"));

      expect(deleteFeedbackRecord).toHaveBeenCalledWith("h1");
      expect(resultOf(later, outcomeRow("r1"))?.status).toBe("again");
    });

    test("an unreachable Hub (no status) reads as a failure too, never an exception", async () => {
      addResponse("r1", { outcome: "lowQuality" });
      vi.mocked(listFeedbackRecords).mockResolvedValueOnce(hubError(0));

      const results = await run(outcomeRow("r1"));

      expect(resultOf(results, outcomeRow("r1"))).toEqual({ status: "failed", error: "hubList:0" });
    });

    test("a restore's rebuild fails softly and a later run completes it", async () => {
      addResponse("r1");
      vi.mocked(createFeedbackRecordsBatch).mockImplementationOnce((async (inputs: unknown[]) => ({
        results: inputs.map(() => hubError(503)),
      })) as never);

      const down = await run(outcomeRow("r1"));

      expect(resultOf(down, outcomeRow("r1"))).toEqual({ status: "failed", error: "hubReconcile:503" });
      const later = await run(outcomeRow("r1"));
      expect(resultOf(later, outcomeRow("r1"))).toEqual({ status: "done" });
      expect(createdRecords()).toHaveLength(4);
    });
  });

  describe("a batch", () => {
    const ids = Array.from({ length: 100 }, (_, i) => `r${i}`);

    test("100 marks cost a constant number of database reads and a handful of Hub listings", async () => {
      for (const id of ids) addResponse(id, { outcome: "lowQuality" });
      // The Hub's side of 200 records, which the job pages through: 100, 100, then nothing.
      const held = ids.flatMap((id) => [hubRecord(`${id}-a`, id), hubRecord(`${id}-b`, id, "el-nps")]);
      vi.mocked(listFeedbackRecords).mockImplementation((async () =>
        hubOk({ data: held.slice(0, 100) })) as never);
      vi.mocked(deleteFeedbackRecord).mockImplementation((async (id: string) => {
        held.splice(
          held.findIndex((record) => record.id === id),
          1
        );
        return hubOk({ deleted: true });
      }) as never);

      const results = await reconcileResponseOutcomes(
        ids.map((id) => outcomeRow(id)),
        budget()
      );

      expect(results.size).toBe(100);
      expect(held).toHaveLength(0);
      expect(vi.mocked(deleteFeedbackRecord)).toHaveBeenCalledTimes(200);
      // One read for the responses and one to confirm none changed: not one per response.
      expect(vi.mocked(prisma.response.findMany).mock.calls.length).toBeLessThanOrEqual(3);
      // Removing records needs neither the survey nor its sources.
      expect(vi.mocked(getSurvey)).not.toHaveBeenCalled();
      // 100 responses x 2 records: pages of 100 listed, deleted, then re-listed: nowhere near one listing each.
      expect(vi.mocked(listFeedbackRecords).mock.calls.length).toBeLessThanOrEqual(5);
      // One listing names every response of the batch.
      expect(vi.mocked(listFeedbackRecords).mock.calls[0]?.[0].submission_id).toEqual(ids);
    });

    test("100 restores read the survey and the sources once", async () => {
      for (const id of ids) addResponse(id);

      const results = await reconcileResponseOutcomes(
        ids.map((id) => outcomeRow(id)),
        budget()
      );

      expect(createdRecords()).toHaveLength(200);
      expect([...results.values()].every((r) => r.status === "done")).toBe(true);
      expect(vi.mocked(getSurvey)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(getFeedbackSourcesBySurveyId)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(prisma.response.findMany).mock.calls.length).toBeLessThanOrEqual(3);
    });

    test("an exhausted Hub budget leaves the remaining rows for the next run", async () => {
      for (const id of ids.slice(0, 3)) addResponse(id);

      const results = await reconcileResponseOutcomes(
        ids.slice(0, 3).map((id) => outcomeRow(id)),
        { remaining: 0, deadline: Date.now() + 60_000 }
      );

      expect([...results.values()]).toEqual(Array(3).fill({ status: "again", delayMs: 0 }));
      expect(hubCalls()).toEqual([]);
    });
  });
});
