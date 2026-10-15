import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TRetentionStep } from "../lib/schedule";
import { collectDueTargets, latestOf, loadNoticeOrganization, surveySkips } from "./due-targets";
import type { TRetentionSweepContext } from "./sweep";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    retentionRun: { update: vi.fn() },
    organization: { findUniqueOrThrow: vi.fn() },
  },
}));
// Small budgets, so a test can fill the lists and pages without thousands of rows.
vi.mock("./constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./constants")>()),
  RETENTION_SWEEP_BATCH_SIZE: 2,
  RETENTION_NOTICES_PER_RUN: 1,
  RETENTION_ACTIONS_PER_RUN: 2,
}));
vi.mock("./transaction", () => ({
  runSweepTransaction: vi.fn((fn: (tx: unknown) => unknown) => fn({ tx: true })),
}));

/**
 * Resuming across nights against a real database (a capped scan records its cursor, the next run starts
 * after it) is proven in `sweep.integration.test.ts`. These pin how the scan splits its budget, fills
 * its lists, and decides where it stopped.
 */
const NOW = new Date("2030-01-10T00:00:00.000Z");

const context = (overrides: Partial<TRetentionSweepContext> = {}): TRetentionSweepContext =>
  ({
    runId: "clrun",
    now: NOW,
    resumeAfter: null,
    restartedWarning: null,
    deadline: NOW.getTime() + 60_000,
    policy: {
      id: "clpol",
      organizationId: "clorg",
      entity: "surveys",
      enabledAt: NOW,
      warnDays: 7,
      periodDays: 30,
      conditions: [],
    },
    ...overrides,
  }) as TRetentionSweepContext;

type TTarget = { id: string; step: TRetentionStep | null };
const target = (id: string, step: TRetentionStep | null): TTarget => ({ id, step });
const scan = { keyOf: (item: TTarget) => item.id, stepOf: (item: TTarget) => item.step };

/** A paged reader over `pages`, recording the key each read started after. */
const pagesOf = (pages: TTarget[][], onRead?: () => void) => {
  const afterKeys: (string | undefined)[] = [];
  const readPage = vi.fn(async (_tx: unknown, afterKey: string | undefined) => {
    afterKeys.push(afterKey);
    onRead?.();
    return pages[afterKeys.length - 1] ?? [];
  });
  return { readPage, afterKeys };
};

describe("collectDueTargets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("reads from where the last run stopped to the end, sorts by step, and records no cursor", async () => {
    const { readPage, afterKeys } = pagesOf([
      [target("a", "notify"), target("b", null)],
      [target("c", "act")],
    ]);

    const result = await collectDueTargets(context({ resumeAfter: "0" }), { readPage, ...scan });

    expect(afterKeys).toEqual(["0", "b"]);
    expect(result).toEqual({ notify: [target("a", "notify")], act: [target("c", "act")] });
    expect(prisma.retentionRun.update).not.toHaveBeenCalled();
  });

  test("keeps each list to its cap and stops scanning once both are full, recording where it stopped", async () => {
    const { readPage, afterKeys } = pagesOf([
      [target("a", "notify"), target("b", "notify")],
      [target("c", "act"), target("d", "act")],
      [target("e", "act"), target("f", "act")],
    ]);

    const result = await collectDueTargets(context(), { readPage, ...scan });

    expect(result).toEqual({
      notify: [target("a", "notify")],
      act: [target("c", "act"), target("d", "act")],
    });
    expect(afterKeys).toEqual([undefined, "b"]);
    expect(prisma.retentionRun.update).toHaveBeenCalledWith({
      where: { id: "clrun" },
      data: { scanCursor: "d" },
    });
  });

  test("gives the scan half of the time left, so notices and actions keep the other half", async () => {
    // 60s left: the scan may start pages for 30s. Each read takes 20s, so a second starts and a third not.
    const { readPage, afterKeys } = pagesOf(
      [
        [target("a", null), target("b", null)],
        [target("c", null), target("d", null)],
        [target("e", null), target("f", null)],
      ],
      () => vi.advanceTimersByTime(20_000)
    );

    await collectDueTargets(context(), { readPage, ...scan });

    expect(afterKeys).toEqual([undefined, "b"]);
    expect(prisma.retentionRun.update).toHaveBeenCalledWith({
      where: { id: "clrun" },
      data: { scanCursor: "d" },
    });
  });

  test("reads nothing once the run is past its deadline, and leaves the cursor where it was", async () => {
    const { readPage } = pagesOf([[target("a", "act")]]);

    await expect(
      collectDueTargets(context({ deadline: NOW.getTime() - 1, resumeAfter: "x" }), { readPage, ...scan })
    ).resolves.toEqual({ notify: [], act: [] });
    expect(readPage).not.toHaveBeenCalled();
    // Rewriting the same cursor is harmless; what matters is it isn't cleared or moved.
    expect(vi.mocked(prisma.retentionRun.update).mock.calls.flatMap((call) => call[0].data)).toEqual([
      { scanCursor: "x" },
    ]);
  });
});

describe("loadNoticeOrganization", () => {
  test("states dates in the organisation's reporting time zone, UTC when it has none", async () => {
    vi.mocked(prisma.organization.findUniqueOrThrow)
      .mockResolvedValueOnce({ name: "Acme", displayTimeZone: "Europe/Lisbon" } as never)
      .mockResolvedValueOnce({ name: "Acme", displayTimeZone: null } as never);

    await expect(loadNoticeOrganization("clorg")).resolves.toEqual({
      name: "Acme",
      timeZone: "Europe/Lisbon",
    });
    await expect(loadNoticeOrganization("clorg")).resolves.toEqual({ name: "Acme", timeZone: "UTC" });
    expect(prisma.organization.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "clorg" },
      select: { name: true, displayTimeZone: true },
    });
  });
});

describe("surveySkips", () => {
  test("records held surveys as exempt and unreachable ones as having no recipient", () => {
    expect(surveySkips([{ id: "s1", name: "Held" }], [{ id: "s2", name: "Orphan" }])).toEqual([
      { targetType: "survey", targetId: "s1", targetName: "Held", skipReason: "exempt" },
      { targetType: "survey", targetId: "s2", targetName: "Orphan", skipReason: "noRecipient" },
    ]);
  });
});

describe("latestOf", () => {
  test("is the latest date given, ignoring missing ones", () => {
    const early = new Date("2030-01-01T00:00:00.000Z");
    const late = new Date("2030-02-01T00:00:00.000Z");

    expect(latestOf(early)).toBe(early);
    expect(latestOf(early, null, late, null)).toBe(late);
    expect(latestOf(late, early)).toBe(late);
  });
});
