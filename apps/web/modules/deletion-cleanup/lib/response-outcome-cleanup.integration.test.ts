import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { setScopedResponsesOutcome } from "@/app/api/v3/responses/lib/write-service";
import { resetDb } from "@/integration/reset-db";
import { reconcileFeedbackRecords } from "@/lib/feedback-source/reconcile";
import { transformResponseToFeedbackRecords } from "@/lib/feedback-source/transform";
import { mapResponsePrismaToResponse, responseSelection } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import {
  createFeedbackRecordsBatch,
  deleteFeedbackRecord,
  listFeedbackRecords,
  updateFeedbackRecord,
} from "@/modules/hub/service";
import { CLEANUP_SETTLE_MS } from "./constants";
import { drainDeletionCleanups } from "./drain";

/**
 * Low quality and the Hub (ENG-6785) against a real Postgres: the outcome write, the queue rows it commits,
 * the drain's claims and the cleanup job, with the Hub replaced by call-recording mocks at
 * `modules/hub/service.ts`. Proves the SQL (one row per response, cancelling by response id, the
 * `DeletionCleanup_kind_check` shape, leases) and the Hub calls the queue produces. It does not prove the
 * real Hub.
 */

vi.mock("@/app/lib/pipelines", () => ({ sendToPipeline: vi.fn() }));
vi.mock("@/modules/hub/service", () => ({
  createFeedbackRecordsBatch: vi.fn(),
  deleteFeedbackRecord: vi.fn(),
  listFeedbackRecords: vi.fn(),
  updateFeedbackRecord: vi.fn(),
}));

const hubOk = (data: unknown) => ({ data, error: null }) as never;
const hubError = (status: number, code?: string) =>
  ({ data: null, error: { status, message: `hub ${status}`, detail: "", code } }) as never;

/** Which Hub outage the mocks simulate: every call fails with a 503. */
let hubDown = false;
/** The records the mocked Hub holds, by id, `<submission>:<field>`: the least state that lets a listing end. */
const held = new Set<string>();
const heldOf = (submissionId: string) => [...held].filter((id) => id.startsWith(`${submissionId}:`));

const createdRecords = () => vi.mocked(createFeedbackRecordsBatch).mock.calls.flatMap(([records]) => records);

describe("response outcome and the Hub (real Postgres, mocked Hub client)", () => {
  let organizationId: string;
  let workspaceId: string;
  let directoryId: string;
  let surveyId: string;
  const NOW_ISH = () => Date.now();
  const FIELDS = ["el-text", "el-nps"];

  const createResponses = async (count: number) => {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const { id } = await prisma.response.create({
        data: { surveyId, finished: true, data: { "el-text": `answer ${i}`, "el-nps": i % 11 } },
        select: { id: true },
      });
      ids.push(id);
    }
    return ids;
  };

  /** What the live pipeline does when a response finishes: the Hub then holds its records. */
  const publish = async (ids: string[]) => {
    const survey = (await getSurvey(surveyId))!;
    const mappings = await prisma.feedbackSourceFormbricksMapping.findMany({ where: { surveyId } });
    for (const id of ids) {
      const row = await prisma.response.findUniqueOrThrow({ where: { id }, select: responseSelection });
      const records = transformResponseToFeedbackRecords(
        mapResponsePrismaToResponse(row),
        survey,
        mappings as never,
        directoryId
      );
      await reconcileFeedbackRecords(records, directoryId);
      for (const record of records) held.add(`${id}:${record.field_id}`);
    }
  };

  const mark = (ids: string[], outcome: "lowQuality" | null) =>
    setScopedResponsesOutcome(ids, outcome, { workspaceId });
  const queue = () => prisma.deletionCleanup.findMany({ orderBy: { createdAt: "asc" } });

  beforeEach(async () => {
    vi.clearAllMocks();
    held.clear();
    hubDown = false;
    vi.mocked(createFeedbackRecordsBatch).mockImplementation((async (inputs: unknown[]) => ({
      results: inputs.map(() => (hubDown ? hubError(503) : hubOk({ id: "created" }))),
    })) as never);
    vi.mocked(listFeedbackRecords).mockImplementation((async (params: {
      tenant_id: string;
      source_id: string[];
      submission_id?: string[];
      limit: number;
    }) =>
      hubDown
        ? hubError(503)
        : hubOk({
            data: (params.submission_id ?? [])
              .flatMap(heldOf)
              .slice(0, params.limit)
              .map((id) => ({
                id,
                tenant_id: params.tenant_id,
                source_type: "formbricks_survey",
                source_id: params.source_id[0],
                submission_id: id.split(":")[0],
              })),
          })) as never);
    vi.mocked(deleteFeedbackRecord).mockImplementation((async (id: string) => {
      if (hubDown) return hubError(503);
      held.delete(id);
      return hubOk({ deleted: true });
    }) as never);
    vi.mocked(updateFeedbackRecord).mockResolvedValue(hubOk({ id: "existing" }));
    await resetDb();

    organizationId = (await prisma.organization.create({ data: { name: "Acme" } })).id;
    workspaceId = (await prisma.workspace.create({ data: { name: "Europe", organizationId } })).id;
    directoryId = (await prisma.feedbackDirectory.create({ data: { name: "Main", organizationId } })).id;
    await prisma.feedbackDirectoryWorkspace.create({
      data: { feedbackDirectoryId: directoryId, workspaceId },
    });
    surveyId = (
      await prisma.survey.create({
        data: {
          name: "Product feedback",
          workspaceId,
          type: "link",
          status: "inProgress",
          blocks: [
            {
              id: "block-1",
              name: "Block 1",
              elements: [
                { id: "el-text", type: "openText", headline: { default: "How can we improve?" } },
                { id: "el-nps", type: "nps", headline: { default: "How likely to recommend?" } },
              ],
            },
          ],
        },
      })
    ).id;
    const source = await prisma.feedbackSource.create({
      data: { name: "Hub source", type: "formbricks_survey", workspaceId, feedbackDirectoryId: directoryId },
    });
    await prisma.feedbackSourceFormbricksMapping.createMany({
      data: [
        { feedbackSourceId: source.id, workspaceId, surveyId, elementId: "el-text", hubFieldType: "text" },
        { feedbackSourceId: source.id, workspaceId, surveyId, elementId: "el-nps", hubFieldType: "nps" },
      ],
    });
  });

  test("marking removes the records at once, leaves one row to look again after the settle time, and restoring rebuilds them", async () => {
    const [r1, r2] = await createResponses(2);
    await publish([r1, r2]);
    const originals = createdRecords().filter((record) => record.submission_id === r1);
    expect(originals).toHaveLength(2);
    vi.mocked(createFeedbackRecordsBatch).mockClear();
    vi.mocked(listFeedbackRecords).mockClear();

    const marked = await mark([r1], "lowQuality");

    expect(marked.changes).toHaveLength(1);
    expect((await prisma.response.findUniqueOrThrow({ where: { id: r1 } })).outcome).toBe("lowQuality");
    // Only r1's records were asked for and deleted; r2's stay.
    expect(vi.mocked(listFeedbackRecords).mock.calls[0]?.[0]).toMatchObject({
      tenant_id: directoryId,
      submission_id: [r1],
    });
    expect(
      vi
        .mocked(deleteFeedbackRecord)
        .mock.calls.map(([id]) => id)
        .sort()
    ).toEqual(FIELDS.map((field) => `${r1}:${field}`).sort());
    expect(heldOf(r2)).toHaveLength(2);
    const [row, ...rest] = await queue();
    expect(rest).toEqual([]);
    expect(row).toMatchObject({ kind: "hubResponseOutcome", responseIds: [r1], tenantIds: [directoryId] });
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(NOW_ISH() + CLEANUP_SETTLE_MS - 60_000);

    // Restored inside the settle window: the pending row is cancelled, a fresh one rebuilds and is done.
    await mark([r1], null);

    expect(await queue()).toEqual([]);
    // The same records, whatever order they were sent in.
    expect(createdRecords()).toHaveLength(originals.length);
    expect(createdRecords()).toEqual(expect.arrayContaining(originals));
  });

  test("a batch of 100 queues one row per response, and a later drain converges the Hub", async () => {
    const ids = await createResponses(100);
    await publish(ids);
    expect(held.size).toBe(200);
    hubDown = true;

    await mark(ids, "lowQuality");

    // The first drain found the Hub down: nothing deleted, every row waiting with a backoff.
    await vi.waitFor(async () => expect((await queue()).every((r) => r.attempts === 1)).toBe(true), {
      timeout: 30_000,
      interval: 250,
    });
    const rows = await queue();
    expect(rows).toHaveLength(100);
    expect(new Set(rows.map((r) => r.responseIds[0])).size).toBe(100);
    expect(rows.every((r) => r.attempts === 1 && r.lastError?.startsWith("hubList:"))).toBe(true);
    expect(held.size).toBe(200);

    hubDown = false;
    await prisma.deletionCleanup.updateMany({ data: { nextAttemptAt: new Date() } });
    vi.mocked(listFeedbackRecords).mockClear();
    await drainDeletionCleanups();

    expect(held.size).toBe(0);
    // Not one listing per response.
    expect(vi.mocked(listFeedbackRecords).mock.calls.length).toBeLessThan(40);
    // Each deleted its records and now waits to look once more.
    expect((await queue()).every((r) => r.attempts === 0 && r.lastError === null)).toBe(true);
  });

  test("a Hub outage never fails the marking, and one mark, restore, mark within the outage leaves one row", async () => {
    const [r1] = await createResponses(1);
    await publish([r1]);
    hubDown = true;

    await expect(mark([r1], "lowQuality")).resolves.toMatchObject({ matched: 1 });
    expect(await queue()).toHaveLength(1);
    await mark([r1], null);
    expect(await queue()).toHaveLength(1);
    await mark([r1], "lowQuality");
    const rows = await queue();
    expect(rows).toHaveLength(1);
    expect((await prisma.response.findUniqueOrThrow({ where: { id: r1 } })).outcome).toBe("lowQuality");
    expect(heldOf(r1)).toHaveLength(2);

    hubDown = false;
    await prisma.deletionCleanup.updateMany({ data: { nextAttemptAt: new Date() } });
    await drainDeletionCleanups();

    expect(heldOf(r1)).toHaveLength(0);
  });

  test("a restore refused with tenant_write_conflict (a purge is running) leaves its row pending to retry, and logs no error", async () => {
    const [r1] = await createResponses(1);
    await mark([r1], "lowQuality");
    vi.mocked(listFeedbackRecords).mockClear();
    const logged = vi.spyOn(logger, "error");
    vi.mocked(createFeedbackRecordsBatch).mockImplementation((async (inputs: unknown[]) => ({
      results: inputs.map(() => hubError(409, "tenant_write_conflict")),
    })) as never);

    await mark([r1], null);

    const [row, ...rest] = await queue();
    expect(rest).toEqual([]);
    expect(row).toMatchObject({ attempts: 1, lastError: "hubReconcile:409", responseIds: [r1] });
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(NOW_ISH());
    // A duplicate would have been looked up and patched; this is a refusal to wait out.
    expect(listFeedbackRecords).not.toHaveBeenCalled();
    expect(updateFeedbackRecord).not.toHaveBeenCalled();
    expect(logged).not.toHaveBeenCalled();
    logged.mockRestore();
  });

  test("an organisation with no feedback directory queues nothing", async () => {
    await prisma.feedbackDirectory.deleteMany({ where: { organizationId } });
    const [r1] = await createResponses(1);

    await mark([r1], "lowQuality");

    expect(await queue()).toEqual([]);
  });

  test("the table refuses an outcome row that names no response or several", async () => {
    const base = { kind: "hubResponseOutcome" as const, organizationId, workspaceId, surveyId };

    await expect(prisma.deletionCleanup.create({ data: { ...base, responseIds: [] } })).rejects.toThrow();
    await expect(
      prisma.deletionCleanup.create({ data: { ...base, responseIds: ["a", "b"] } })
    ).rejects.toThrow();
    await expect(
      prisma.deletionCleanup.create({ data: { ...base, responseIds: ["a"] } })
    ).resolves.toBeTruthy();
  });
});
