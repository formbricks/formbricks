import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import {
  RetentionPolicyInvalidError,
  getRetentionPolicyRows,
  resolveRetentionPolicySettings,
  updateRetentionPolicy,
} from "./policies-service";
import { RETENTION_POLICY_DEFAULTS } from "./policy-rules";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: { $transaction: vi.fn(), retentionPolicy: { findMany: vi.fn() } },
}));

/**
 * Saving policies against a real database (the first save's row, two writers serialised on it, the
 * database clock stamping `enabledAt`) is proven in `policies-service.integration.test.ts`. These pin
 * what a save decides from the row it locked: what it writes, and when it restarts the warning.
 */
const statement = (args: unknown[]) => {
  const [strings, ...values] = args as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql.replace(/\s+/g, " "), values: sql.values };
};

const ORG_ID = "clorg";
const NOW = new Date("2030-01-10T00:00:00.000Z");
const DB_NOW = new Date("2030-01-10T00:00:05.123Z");
const ENABLED_AT = new Date("2029-12-01T00:00:00.000Z");

const savedRow = (overrides: Record<string, unknown> = {}) => ({
  id: "clpol",
  entity: "members",
  enabled: true,
  enabledAt: ENABLED_AT,
  warnDays: 30,
  periodDays: 365,
  conditions: [],
  ...overrides,
});

/** A transaction whose policy row is `row`, freshly inserted by this save or not. */
const transaction = ({ inserted, row }: { inserted: boolean; row: ReturnType<typeof savedRow> }) => {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(inserted ? 1 : 0),
    $queryRaw: vi.fn(async (...args: unknown[]) =>
      statement(args).text.includes("clock_timestamp()") ? [{ now: DB_NOW }] : []
    ),
    retentionPolicy: { findUniqueOrThrow: vi.fn().mockResolvedValue(row), update: vi.fn() },
  };
  vi.mocked(prisma.$transaction).mockImplementation(((fn: (client: typeof tx) => unknown) =>
    fn(tx)) as never);
  return tx;
};

/** Saves with the clock pinned to `NOW`, or with the database's clock when `now` is null. */
const save = (patch: Parameters<typeof updateRetentionPolicy>[0]["patch"], now: Date | null = NOW) =>
  updateRetentionPolicy({
    organizationId: ORG_ID,
    policy: "members",
    patch,
    updatedById: "cluser",
    now: now ?? undefined,
  });

describe("updateRetentionPolicy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates a never-saved policy's row from its defaults, then locks it", async () => {
    const tx = transaction({ inserted: true, row: savedRow({ enabled: false, enabledAt: null }) });

    await save({ enabled: true });

    const insert = statement(tx.$executeRaw.mock.calls[0]);
    expect(insert.text).toContain('ON CONFLICT ("organizationId", "entity") DO NOTHING');
    expect(insert.values).toEqual([
      expect.any(String),
      ORG_ID,
      "members",
      RETENTION_POLICY_DEFAULTS.members.warnDays,
      RETENTION_POLICY_DEFAULTS.members.periodDays,
      NOW,
    ]);
    expect(statement(tx.$queryRaw.mock.calls[0]).text).toContain("FOR UPDATE");
  });

  test("merges a first save over the defaults and starts its warning now", async () => {
    // The fresh row still holds its placeholder settings: the defaults are what it was.
    const tx = transaction({
      inserted: true,
      row: savedRow({ enabled: false, enabledAt: null, warnDays: 1 }),
    });

    await expect(save({ enabled: true, periodDays: 400 })).resolves.toEqual({
      id: "clpol",
      previous: RETENTION_POLICY_DEFAULTS.members,
      next: { ...RETENTION_POLICY_DEFAULTS.members, enabled: true, periodDays: 400 },
      changed: true,
    });
    expect(tx.retentionPolicy.update).toHaveBeenCalledWith({
      where: { id: "clpol" },
      data: {
        ...RETENTION_POLICY_DEFAULTS.members,
        enabled: true,
        periodDays: 400,
        enabledAt: NOW,
        updatedById: "cluser",
      },
    });
  });

  test("writes a first save's row even when it changes nothing, so it stops holding placeholders", async () => {
    const tx = transaction({ inserted: true, row: savedRow({ enabled: false, enabledAt: null }) });

    await expect(save({})).resolves.toMatchObject({ changed: false });
    expect(tx.retentionPolicy.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ enabled: false, enabledAt: null }) })
    );
  });

  test("writes nothing, and reports no change, when a saved policy is saved as it is", async () => {
    const tx = transaction({ inserted: false, row: savedRow() });

    await expect(save({ warnDays: 30 })).resolves.toMatchObject({ changed: false });
    expect(tx.retentionPolicy.update).not.toHaveBeenCalled();
  });

  test.each([
    ["restarts the warning when the period gets shorter", { periodDays: 300 }, DB_NOW],
    ["keeps the warning when the period gets longer", { periodDays: 400 }, ENABLED_AT],
  ])("%s, on the database clock read after the lock", async (_case, patch, enabledAt) => {
    const tx = transaction({ inserted: false, row: savedRow() });

    await expect(save(patch, null)).resolves.toMatchObject({ changed: true });

    expect(tx.retentionPolicy.update.mock.calls[0][0].data.enabledAt).toEqual(enabledAt);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.$queryRaw.mock.invocationCallOrder[1]);
  });

  test("rejects a policy that breaks a rule and writes nothing", async () => {
    const tx = transaction({ inserted: true, row: savedRow({ enabled: false, enabledAt: null }) });

    const error = await save({ warnDays: 400 }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RetentionPolicyInvalidError);
    expect((error as RetentionPolicyInvalidError).issues.map((issue) => issue.field)).toEqual([
      "warnDays",
      "warnDays",
    ]);
    expect(tx.retentionPolicy.update).not.toHaveBeenCalled();
  });
});

describe("policy settings", () => {
  test("reads the organisation's saved rows", async () => {
    vi.mocked(prisma.retentionPolicy.findMany).mockResolvedValue([savedRow()] as never);

    await expect(getRetentionPolicyRows(ORG_ID)).resolves.toEqual([savedRow()]);
    expect(vi.mocked(prisma.retentionPolicy.findMany).mock.calls[0][0]?.where).toEqual({
      organizationId: ORG_ID,
    });
  });

  test("resolves each policy to its saved settings, or its defaults if never saved", () => {
    const settings = resolveRetentionPolicySettings([
      { entity: "members", enabled: true, warnDays: 30, periodDays: 365, conditions: [] },
    ]);

    expect(settings).toEqual({
      responses: RETENTION_POLICY_DEFAULTS.responses,
      surveys: RETENTION_POLICY_DEFAULTS.surveys,
      members: { enabled: true, warnDays: 30, periodDays: 365, conditions: [] },
    });
    // A copy: changing it never touches the shared defaults.
    expect(settings.surveys.conditions).not.toBe(RETENTION_POLICY_DEFAULTS.surveys.conditions);
  });
});
