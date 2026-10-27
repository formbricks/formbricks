import { prisma } from "@/lib/__mocks__/database";
import { FakeHub } from "@/modules/hub/__mocks__/fake-hub";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CLEANUP_SETTLE_MS } from "./constants";
import { type TOutcomeCleanupRow, reconcileResponseOutcomes } from "./hub-outcome";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/env", () => ({ env: { HUB_API_KEY: "fake-hub-key", HUB_API_URL: "http://hub.test" } }));
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

const { getSurvey } = await import("@/lib/survey/service");
const { getFeedbackSourcesBySurveyId } = await import("@/lib/feedback-source/service");
const { reconcileFeedbackRecords } = await import("@/lib/feedback-source/reconcile");
const { transformResponseToFeedbackRecords } = await import("@/lib/feedback-source/transform");

/**
 * The reconcile job against a fake Hub (`modules/hub/__mocks__/fake-hub.ts`) reached through the real
 * `@formbricks/hub` client and `modules/hub/service.ts`; only the database reads are faked. What this
 * proves is the job's decisions and the Hub traffic they produce. It does not prove the SQL of the queue
 * (see the integration test) or the behaviour of the real Hub service.
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

const hub = new FakeHub("fake-hub-key");
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

/** What the live pipeline does on responseFinished: the records Hub holds for a response. */
const publish = async (id: string) => {
  const row = responses.get(id);
  if (!row) throw new Error("unknown response");
  const records = transformResponseToFeedbackRecords(
    dbRow(row) as never,
    survey() as never,
    source().formbricksMappings as never,
    TENANT
  );
  await reconcileFeedbackRecords(records, TENANT);
};

/** Values a record carries, without what Hub assigns (id and timestamps). */
const content = (submissionId?: string) =>
  hub
    .records({ submissionId })
    .map(({ id: _id, created_at: _c, updated_at: _u, collected_at: _a, ...rest }) => rest)
    .sort((a, b) => `${a.submission_id}${a.field_id}`.localeCompare(`${b.submission_id}${b.field_id}`));

const run = async (...rows: TOutcomeCleanupRow[]) => reconcileResponseOutcomes(rows, budget());
const resultOf = (results: Awaited<ReturnType<typeof run>>, row: TOutcomeCleanupRow) => results.get(row.id);

describe("reconcileResponseOutcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", (request: Request) => hub.handle(request));
    (globalThis as unknown as { formbricksHubHeyApiClient: unknown }).formbricksHubHeyApiClient = undefined;
    hub.outage = null;
    hub.onRequest = undefined;
    hub.clear();
    hub.clearRequests();
    responses = new Map();

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
    vi.unstubAllGlobals();
  });

  describe("marking Low quality", () => {
    test("removes that response's records and nothing else", async () => {
      addResponse("r1");
      addResponse("r2");
      await publish("r1");
      await publish("r2");
      hub.seed({
        tenant_id: TENANT,
        source_type: "formbricks_survey",
        source_id: "another-survey",
        submission_id: "r1",
        field_id: "el-text",
        field_type: "text",
      });
      responses.get("r1")!.outcome = "lowQuality";

      const results = await run(outcomeRow("r1"));

      expect(hub.records({ submissionId: "r1" }).map((r) => r.source_id)).toEqual(["another-survey"]);
      expect(hub.records({ submissionId: "r2" })).toHaveLength(2);
      // Looked at once more after the settle time, for a record still on its way to the Hub.
      expect(resultOf(results, outcomeRow("r1"))).toEqual({ status: "again", delayMs: CLEANUP_SETTLE_MS });
    });

    test("is idempotent: a second pass finds nothing left and is done", async () => {
      addResponse("r1", { outcome: "lowQuality" });
      await publish("r1");

      await run(outcomeRow("r1"));
      hub.clearRequests();
      const second = await run(outcomeRow("r1"));

      expect(hub.records({ submissionId: "r1" })).toHaveLength(0);
      expect(resultOf(second, outcomeRow("r1"))).toEqual({ status: "done" });
      expect(hub.count("DELETE")).toBe(0);
    });

    test("a response that was never published costs one listing and is done", async () => {
      addResponse("r1", { outcome: "lowQuality", finished: false });

      const results = await run(outcomeRow("r1"));

      expect(resultOf(results, outcomeRow("r1"))).toEqual({ status: "done" });
      expect(hub.requests.map((r) => r.method)).toEqual(["GET"]);
    });

    test("a response deleted in the meantime is left to its own deletion cleanup", async () => {
      const results = await run(outcomeRow("gone"));

      expect(resultOf(results, outcomeRow("gone"))).toEqual({ status: "done" });
      expect(hub.requests).toHaveLength(0);
    });
  });

  describe("restoring", () => {
    test("rebuilds the records with the same values", async () => {
      addResponse("r1");
      await publish("r1");
      const before = content("r1");
      expect(before).toHaveLength(2);

      responses.get("r1")!.outcome = "lowQuality";
      await run(outcomeRow("r1"));
      expect(hub.records({ submissionId: "r1" })).toHaveLength(0);

      responses.get("r1")!.outcome = null;
      const results = await run(outcomeRow("r1"));

      expect(content("r1")).toEqual(before);
      expect(resultOf(results, outcomeRow("r1"))).toEqual({ status: "done" });
    });

    test("is idempotent: running it again changes nothing", async () => {
      addResponse("r1");
      await run(outcomeRow("r1"));
      const once = content("r1");
      expect(once).toHaveLength(2);

      const again = await run(outcomeRow("r1"));

      expect(content("r1")).toEqual(once);
      expect(resultOf(again, outcomeRow("r1"))).toEqual({ status: "done" });
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

      expect(hub.records()).toHaveLength(0);
      expect(hub.count("POST")).toBe(0);
      expect(resultOf(results, outcomeRow("r1"))).toEqual({ status: "done" });
    });
  });

  describe("a quick sequence of changes", () => {
    test("mark, restore, mark ends with no records, whichever rows ran", async () => {
      addResponse("r1");
      await publish("r1");

      responses.get("r1")!.outcome = "lowQuality";
      await run(outcomeRow("r1")); // the first mark's row
      responses.get("r1")!.outcome = null;
      await run(outcomeRow("r1")); // the restore's row (the mark's pending row was cancelled)
      expect(hub.records({ submissionId: "r1" })).toHaveLength(2);
      responses.get("r1")!.outcome = "lowQuality";
      await run(outcomeRow("r1")); // the second mark's row

      expect(hub.records({ submissionId: "r1" })).toHaveLength(0);
    });

    test("a stale row follows the CURRENT outcome: a mark row run after a restore rebuilds", async () => {
      addResponse("r1");
      await publish("r1");
      responses.get("r1")!.outcome = "lowQuality";
      await run(outcomeRow("r1"));

      // Restored inside the settle window; the mark's pending row was not cancelled (or runs late).
      responses.get("r1")!.outcome = null;
      await run(outcomeRow("r1"));

      expect(hub.records({ submissionId: "r1" })).toHaveLength(2);
    });

    test("a restore that lands while the records are being deleted still ends with them rebuilt", async () => {
      addResponse("r1", { outcome: "lowQuality" });
      await publish("r1");
      // The first Hub delete is where the reviewer restores.
      let restored = false;
      hub.onRequest = (request) => {
        if (request.method === "DELETE" && !restored) {
          restored = true;
          responses.get("r1")!.outcome = null;
        }
      };

      const results = await run(outcomeRow("r1"));

      expect(restored).toBe(true);
      expect(hub.records({ submissionId: "r1" })).toHaveLength(2);
      expect(resultOf(results, outcomeRow("r1"))?.status).not.toBe("failed");
    });

    test("a mark that lands while the records are being rebuilt still ends with none", async () => {
      addResponse("r1");
      let marked = false;
      hub.onRequest = (request) => {
        if (request.method === "POST" && !marked) {
          marked = true;
          responses.get("r1")!.outcome = "lowQuality";
        }
      };

      await run(outcomeRow("r1"));

      expect(marked).toBe(true);
      expect(hub.records({ submissionId: "r1" })).toHaveLength(0);
    });

    test("an outcome that keeps flipping is left to the next run, not looped on", async () => {
      addResponse("r1", { outcome: "lowQuality" });
      await publish("r1");
      // Flips once after every database read: the reviewer is faster than every pass.
      let armed = false;
      const read = vi.mocked(prisma.response.findMany).getMockImplementation() as (args: never) => unknown;
      vi.mocked(prisma.response.findMany).mockImplementation(((args: never) => {
        armed = true;
        return read(args);
      }) as never);
      hub.onRequest = () => {
        if (!armed) return;
        armed = false;
        const row = responses.get("r1")!;
        row.outcome = row.outcome ? null : "lowQuality";
      };

      const results = await run(outcomeRow("r1"));

      expect(resultOf(results, outcomeRow("r1"))).toEqual({ status: "again", delayMs: 0 });
    });
  });

  describe("the Hub is down", () => {
    test("a mark's cleanup fails softly, keeps the records, and a later run finishes it", async () => {
      addResponse("r1", { outcome: "lowQuality" });
      await publish("r1");
      hub.outage = "down";

      const down = await run(outcomeRow("r1"));

      expect(resultOf(down, outcomeRow("r1"))).toEqual({ status: "failed", error: "hubList:503" });
      hub.outage = null;
      expect(hub.records({ submissionId: "r1" })).toHaveLength(2);

      await run(outcomeRow("r1"));
      expect(hub.records({ submissionId: "r1" })).toHaveLength(0);
    });

    test("an unreachable Hub reads as a failure too, never an exception", async () => {
      addResponse("r1", { outcome: "lowQuality" });
      hub.outage = "unreachable";

      const results = await run(outcomeRow("r1"));

      expect(resultOf(results, outcomeRow("r1"))?.status).toBe("failed");
    });

    test("a restore's rebuild fails softly and a later run completes it", async () => {
      addResponse("r1");
      hub.outage = "down";

      const down = await run(outcomeRow("r1"));

      expect(resultOf(down, outcomeRow("r1"))?.status).toBe("failed");
      hub.outage = null;
      await run(outcomeRow("r1"));
      expect(hub.records({ submissionId: "r1" })).toHaveLength(2);
    });
  });

  describe("a batch", () => {
    const ids = Array.from({ length: 100 }, (_, i) => `r${i}`);

    test("100 marks cost a constant number of database reads and a handful of Hub listings", async () => {
      for (const id of ids) addResponse(id, { outcome: "lowQuality" });
      for (const id of ids) {
        responses.get(id)!.outcome = null;
        await publish(id);
        responses.get(id)!.outcome = "lowQuality";
      }
      expect(hub.records()).toHaveLength(200);
      vi.mocked(prisma.response.findMany).mockClear();
      vi.mocked(getSurvey).mockClear();
      vi.mocked(getFeedbackSourcesBySurveyId).mockClear();
      hub.clearRequests();

      const rows = ids.map((id) => outcomeRow(id));
      const results = await reconcileResponseOutcomes(rows, budget());

      expect(hub.records()).toHaveLength(0);
      expect(results.size).toBe(100);
      // One read for the responses and one to confirm none changed: not one per response.
      expect(vi.mocked(prisma.response.findMany).mock.calls.length).toBeLessThanOrEqual(3);
      // Removing records needs neither the survey nor its sources.
      expect(vi.mocked(getSurvey)).not.toHaveBeenCalled();
      // 100 responses x 2 records: a page of 100 listed, deleted, then re-listed: nowhere near one listing each.
      expect(hub.count("GET")).toBeLessThanOrEqual(5);
    });

    test("100 restores read the survey and the sources once", async () => {
      for (const id of ids) addResponse(id);

      const results = await reconcileResponseOutcomes(
        ids.map((id) => outcomeRow(id)),
        budget()
      );

      expect(hub.records()).toHaveLength(200);
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
      expect(hub.requests).toHaveLength(0);
    });
  });
});
