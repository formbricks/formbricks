import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { SURVEY_ARCHIVE_RETENTION_DAYS } from "@/modules/survey/archive/lib/retention-days";
import { archiveSurvey } from "@/modules/survey/lib/surveys";
import { addRetentionDays } from "../lib/schedule";
import { type TNoticeRecipient, resolveSurveyNoticeRecipients } from "./recipients";
import { recordRetentionRunActions, recordRetentionRunSkips } from "./run";
import type { TSurveyNoticeItem } from "./survey-notices";
import { archiveDueSurvey, createSurveysSweeper } from "./surveys-sweeper";
import type { TRetentionSweepContext } from "./sweep";
import {
  type TRetentionPolicySnapshot,
  lockUnchangedRetentionPolicy,
  runSweepTransaction,
} from "./transaction";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { retentionRun: { update: vi.fn() } } }));
vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEventWithoutRequest: vi.fn() }));
vi.mock("@/modules/survey/lib/surveys", () => ({ archiveSurvey: vi.fn() }));
vi.mock("./recipients", () => ({ resolveSurveyNoticeRecipients: vi.fn() }));
vi.mock("./run", () => ({ recordRetentionRunActions: vi.fn(), recordRetentionRunSkips: vi.fn() }));
vi.mock("./transaction", () => ({ runSweepTransaction: vi.fn(), lockUnchangedRetentionPolicy: vi.fn() }));

/**
 * The surveys policy against a real database (the ticked conditions select the right surveys, an
 * exemption on either policy holds one, activity voids the notice, the purge takes it from there) is
 * proven in `surveys-sweeper.integration.test.ts`. These pin the decisions made on what the queries
 * return: what the notice says, and when a survey is archived.
 */
const statement = (args: unknown[]) => {
  const [strings, ...values] = args as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql.replace(/\s+/g, " "), values: sql.values };
};

const NOW = new Date("2030-03-01T01:00:00.000Z");
const daysAgo = (days: number) => addRetentionDays(NOW, -days);
const POLICY: TRetentionPolicySnapshot = {
  id: "clpol",
  organizationId: "clorg",
  entity: "surveys",
  enabledAt: daysAgo(60),
  warnDays: 7,
  periodDays: 30,
  conditions: ["noResponse", "createdBefore"],
};
const NOTICE_DUE_AT_OR_BEFORE = daysAgo(23);

const context = (overrides: Partial<TRetentionSweepContext> = {}): TRetentionSweepContext => ({
  runId: "clrun",
  now: NOW,
  policy: POLICY,
  restartedWarning: null,
  resumeAfter: null,
  deadline: NOW.getTime() + 120_000,
  ...overrides,
});

type TRow = {
  id: string;
  name: string;
  workspaceId: string;
  ownerId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  newestResponseAt: Date | null;
  noticeClaimedAt: Date | null;
  noticeDeliveredAt: Date | null;
  heldUntil: Date | null;
};
/** Untouched for 25 days: its notice is due. */
const candidate = (id: string, overrides: Partial<TRow> = {}): TRow => ({
  id,
  name: `Survey ${id}`,
  workspaceId: "clwsp",
  ownerId: "alice",
  createdBy: null,
  createdAt: daysAgo(100),
  updatedAt: daysAgo(25),
  newestResponseAt: null,
  noticeClaimedAt: null,
  noticeDeliveredAt: null,
  heldUntil: null,
  ...overrides,
});
/** Untouched for 40 days and told 10 days ago: its warning has run, it is due to be archived. */
const dueForArchive = (id: string) =>
  candidate(id, { updatedAt: daysAgo(40), noticeClaimedAt: daysAgo(10), noticeDeliveredAt: daysAgo(10) });

const ALICE: TNoticeRecipient = {
  userId: "alice",
  email: "alice@example.com",
  name: "Alice",
  locale: "en-US",
};
const format = { date: (date: Date) => date.toISOString(), number: String };

/** The value bound to the `?` that ends `marker` in the statement, if the statement has it. */
const boundAt = (text: string, values: unknown[], marker: string): unknown => {
  const end = text.indexOf(marker);
  if (end === -1) return undefined;
  return values[(text.slice(0, end + marker.length).match(/\?/g) ?? []).length - 1];
};

/** The database as the sweeper's raw statements see it. */
const database = ({
  candidates = [] as TRow[],
  held = [] as { id: string; name: string }[],
  recheck = (id: string): TRow[] => candidates.filter((row) => row.id === id),
} = {}) => {
  const tx = {
    $queryRaw: vi.fn(async (...args: unknown[]) => {
      const { text, values } = statement(args);
      if (text.includes('FROM "RetentionExemption" e JOIN "Survey" s')) return held;
      if (text.includes('FROM "Survey" s JOIN "Workspace" w')) {
        const surveyId = boundAt(text, values, 'AND s."id" = ?');
        return surveyId === undefined ? candidates : recheck(surveyId as string);
      }
      return [];
    }),
  };
  vi.mocked(runSweepTransaction).mockImplementation(((fn: (client: typeof tx) => unknown) =>
    fn(tx)) as never);
  return tx;
};

const candidateStatements = (tx: ReturnType<typeof database>) =>
  tx.$queryRaw.mock.calls.map(statement).filter(({ text }) => text.includes('FROM "Survey" s JOIN'));

describe("createSurveysSweeper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(resolveSurveyNoticeRecipients).mockResolvedValue(new Map());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("pushes the ticked conditions into the candidate query, and only them", async () => {
    const ticked = database();
    await createSurveysSweeper()(context());
    const [withConditions] = candidateStatements(ticked);
    expect(withConditions.text).toContain('s."archivedAt" IS NULL');
    expect(withConditions.text).toContain('(s."publishOn" IS NULL OR s."publishOn" <= ?)');
    expect(withConditions.text).toContain(
      'AND NOT EXISTS ( SELECT 1 FROM "Response" r WHERE r."surveyId" = s."id" AND r."created_at" > ? )'
    );
    expect(withConditions.text).toContain('AND s."created_at" <= ?');
    expect(withConditions.values).toEqual([
      "clorg",
      NOW,
      NOTICE_DUE_AT_OR_BEFORE,
      NOTICE_DUE_AT_OR_BEFORE,
      NOTICE_DUE_AT_OR_BEFORE,
      NOW,
      100,
    ]);

    const unticked = database();
    await createSurveysSweeper()(context({ policy: { ...POLICY, conditions: [] } }));
    const [updatedOnly] = candidateStatements(unticked);
    expect(updatedOnly.text).not.toContain('r."created_at" > ?');
    expect(updatedOnly.text).not.toContain('s."created_at" <= ?');
  });

  test("tells a survey's recipient when it will be archived and purged, voided by any later activity", async () => {
    database({ candidates: [candidate("s1"), candidate("s2", { heldUntil: daysAgo(5) }), candidate("s3")] });
    vi.mocked(resolveSurveyNoticeRecipients).mockResolvedValue(
      new Map([
        ["s1", ALICE],
        ["s2", ALICE],
      ])
    );

    const plan = await createSurveysSweeper()(context());
    const items = (plan.surveyNotices?.items ?? []) as TSurveyNoticeItem<"surveys">[];

    expect(plan.surveyNotices?.entity).toBe("surveys");
    expect(resolveSurveyNoticeRecipients).toHaveBeenCalledWith(
      "clorg",
      [
        expect.objectContaining({ id: "s1" }),
        expect.objectContaining({ id: "s2" }),
        expect.objectContaining({ id: "s3" }),
      ],
      undefined
    );
    // The notice is void if claimed before the survey's clock: activity since restarts it.
    expect(items.map((item) => [item.survey.id, item.voidBefore])).toEqual([
      ["s1", daysAgo(25)],
      ["s2", daysAgo(5)],
    ]);
    const archiveAt = addRetentionDays(NOW, 7);
    expect(items[0].describe(format, "https://app/s1")).toEqual({
      name: "Survey s1",
      url: "https://app/s1",
      archiveDate: archiveAt.toISOString(),
      deleteDate: addRetentionDays(archiveAt, SURVEY_ARCHIVE_RETENTION_DAYS).toISOString(),
    });
  });

  test("archives the surveys due tonight, then records the held and unreachable ones as skipped", async () => {
    database({
      candidates: [candidate("s0"), dueForArchive("s1")],
      held: [{ id: "s9", name: "Held" }],
    });

    const plan = await createSurveysSweeper()(context());
    await plan.act(NOW.getTime() + 60_000);

    expect(archiveSurvey).toHaveBeenCalledTimes(1);
    expect(archiveSurvey).toHaveBeenCalledWith("s1", { tx: expect.anything() });
    expect(recordRetentionRunSkips).toHaveBeenCalledWith(expect.objectContaining({ runId: "clrun" }), [
      { targetType: "survey", targetId: "s9", targetName: "Held", skipReason: "exempt" },
      { targetType: "survey", targetId: "s0", targetName: "Survey s0", skipReason: "noRecipient" },
    ]);
  });

  test("starts no archive past the deadline", async () => {
    database({ candidates: [dueForArchive("s1")] });

    const plan = await createSurveysSweeper()(context());
    await plan.act(NOW.getTime() - 1);

    expect(archiveSurvey).not.toHaveBeenCalled();
    expect(recordRetentionRunSkips).toHaveBeenCalled();
  });
});

describe("archiveDueSurvey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("locks the survey, holds the policy, archives it and records it, then audits as the system", async () => {
    const tx = database({ candidates: [dueForArchive("s1")] });

    await expect(archiveDueSurvey(context(), "s1", NOTICE_DUE_AT_OR_BEFORE)).resolves.toBe(true);

    expect(statement(tx.$queryRaw.mock.calls[0]).text).toBe(
      'SELECT 1 FROM "Survey" WHERE "id" = ? FOR UPDATE'
    );
    expect(lockUnchangedRetentionPolicy).toHaveBeenCalledWith(tx, POLICY);
    expect(archiveSurvey).toHaveBeenCalledWith("s1", { tx });
    expect(recordRetentionRunActions).toHaveBeenCalledWith(tx, "clrun", [
      { targetType: "survey", targetId: "s1", targetName: "Survey s1", action: "archived" },
    ]);
    expect(queueAuditEventWithoutRequest).toHaveBeenCalledWith({
      action: "archived",
      targetType: "survey",
      targetId: "s1",
      organizationId: "clorg",
      userId: "system",
      userType: "system",
      status: "success",
      newObject: { workspaceId: "clwsp", retentionRunId: "clrun" },
    });
  });

  test.each([
    ["is gone, archived or held", []],
    // Edited since the scan: its clock moved past the notice, which no longer counts.
    ["was edited since its notice", [{ ...dueForArchive("s1"), updatedAt: daysAgo(1) }]],
  ])("archives nothing when the survey %s", async (_case, rows) => {
    database({ recheck: () => rows });

    await expect(archiveDueSurvey(context(), "s1", NOTICE_DUE_AT_OR_BEFORE)).resolves.toBe(false);
    expect(archiveSurvey).not.toHaveBeenCalled();
    expect(queueAuditEventWithoutRequest).not.toHaveBeenCalled();
  });

  test("keeps the archive when its audit fails", async () => {
    database({ candidates: [dueForArchive("s1")] });
    vi.mocked(queueAuditEventWithoutRequest).mockRejectedValue(new Error("audit down"));

    await expect(archiveDueSurvey(context(), "s1", NOTICE_DUE_AT_OR_BEFORE)).resolves.toBe(true);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ surveyId: "s1" }),
      "Data retention survey archive audit failed"
    );
  });
});
