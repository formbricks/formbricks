import { FakeHub } from "@/modules/hub/__mocks__/fake-hub";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { setScopedResponsesOutcome } from "@/app/api/v3/responses/lib/write-service";
import { resetDb } from "@/integration/reset-db";
import { reconcileFeedbackRecords } from "@/lib/feedback-source/reconcile";
import { transformResponseToFeedbackRecords } from "@/lib/feedback-source/transform";
import { mapResponsePrismaToResponse, responseSelection } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { CLEANUP_SETTLE_MS } from "./constants";
import { drainDeletionCleanups } from "./drain";

/**
 * Low quality and the Hub (ENG-6785) against a real Postgres: the outcome write, the queue rows it commits,
 * the drain's claims and the cleanup job, with the Hub replaced by `FakeHub` behind the real client. Proves
 * the SQL (one row per response, cancelling by response id, the `DeletionCleanup_kind_check` shape, leases)
 * and the end state of the Hub's records. It does not prove the real Hub.
 */

vi.mock("@/app/lib/pipelines", () => ({ sendToPipeline: vi.fn() }));

const API_KEY = process.env.HUB_API_KEY ?? "dev-api-key";
const hub = new FakeHub(API_KEY);

describe("response outcome and the Hub (real Postgres, fake Hub)", () => {
  let organizationId: string;
  let workspaceId: string;
  let directoryId: string;
  let surveyId: string;
  const NOW_ISH = () => Date.now();

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

  /** What the live pipeline does when a response finishes. */
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
    }
  };

  const mark = (ids: string[], outcome: "lowQuality" | null) =>
    setScopedResponsesOutcome(ids, outcome, { workspaceId });
  const queue = () => prisma.deletionCleanup.findMany({ orderBy: { createdAt: "asc" } });
  const recordsOf = (id: string) => hub.records({ submissionId: id });

  beforeEach(async () => {
    vi.stubGlobal("fetch", (request: Request) => hub.handle(request));
    (globalThis as unknown as { formbricksHubHeyApiClient: unknown }).formbricksHubHeyApiClient = undefined;
    hub.clear();
    hub.outage = null;
    hub.clearRequests();
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
    const before = hub
      .records({ submissionId: r1 })
      .map(({ id: _i, created_at: _c, updated_at: _u, ...r }) => r);
    expect(before).toHaveLength(2);

    const marked = await mark([r1], "lowQuality");

    expect(marked.changes).toHaveLength(1);
    expect((await prisma.response.findUniqueOrThrow({ where: { id: r1 } })).outcome).toBe("lowQuality");
    expect(recordsOf(r1)).toHaveLength(0);
    expect(recordsOf(r2)).toHaveLength(2);
    const [row, ...rest] = await queue();
    expect(rest).toEqual([]);
    expect(row).toMatchObject({ kind: "hubResponseOutcome", responseIds: [r1], tenantIds: [directoryId] });
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(NOW_ISH() + CLEANUP_SETTLE_MS - 60_000);

    // Restored inside the settle window: the pending row is cancelled, a fresh one rebuilds and is done.
    await mark([r1], null);

    expect(await queue()).toEqual([]);
    expect(
      hub.records({ submissionId: r1 }).map(({ id: _i, created_at: _c, updated_at: _u, ...r }) => r)
    ).toEqual(expect.arrayContaining(before));
    expect(recordsOf(r1)).toHaveLength(2);
  });

  test("a batch of 100 queues one row per response, and a later drain converges the Hub", async () => {
    const ids = await createResponses(100);
    await publish(ids);
    expect(hub.records()).toHaveLength(200);
    hub.outage = "down";

    await mark(ids, "lowQuality");

    // The first drain found the Hub down: nothing deleted, every row waiting with a backoff. The request
    // only waits INLINE_DRAIN_WAIT_MS for it (the SDK retries a failing list for seconds per round of ten
    // rows), so the drain is given the time it needs to finish before the rows are read.
    await vi.waitFor(async () => expect((await queue()).every((r) => r.attempts === 1)).toBe(true), {
      timeout: 30_000,
      interval: 250,
    });
    const rows = await queue();
    expect(rows).toHaveLength(100);
    expect(new Set(rows.map((r) => r.responseIds[0])).size).toBe(100);
    expect(rows.every((r) => r.attempts === 1 && r.lastError?.startsWith("hubList:"))).toBe(true);
    expect(hub.records()).toHaveLength(200);

    hub.outage = null;
    await prisma.deletionCleanup.updateMany({ data: { nextAttemptAt: new Date() } });
    hub.clearRequests();
    await drainDeletionCleanups();

    expect(hub.records()).toHaveLength(0);
    // Not one listing per response.
    expect(hub.count("GET")).toBeLessThan(40);
    // Each deleted its records and now waits to look once more.
    expect((await queue()).every((r) => r.attempts === 0 && r.lastError === null)).toBe(true);
  });

  test("a Hub outage never fails the marking, and one mark, restore, mark within the outage leaves one row", async () => {
    const [r1] = await createResponses(1);
    await publish([r1]);
    hub.outage = "down";

    await expect(mark([r1], "lowQuality")).resolves.toMatchObject({ matched: 1 });
    expect(await queue()).toHaveLength(1);
    await mark([r1], null);
    expect(await queue()).toHaveLength(1);
    await mark([r1], "lowQuality");
    const rows = await queue();
    expect(rows).toHaveLength(1);
    expect((await prisma.response.findUniqueOrThrow({ where: { id: r1 } })).outcome).toBe("lowQuality");
    expect(recordsOf(r1)).toHaveLength(2);

    hub.outage = null;
    await prisma.deletionCleanup.updateMany({ data: { nextAttemptAt: new Date() } });
    await drainDeletionCleanups();

    expect(recordsOf(r1)).toHaveLength(0);
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
