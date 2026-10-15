import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import {
  RetentionExemptionExistsError,
  createRetentionExemption,
  findRetentionExemption,
  getRetentionExemptionOrganizationId,
  getRetentionExemptionSurvey,
  listRetentionExemptionKeysetPage,
  revokeRetentionExemption,
  searchRetentionExemptionSurveys,
} from "./exemptions-service";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    retentionExemption: { findUnique: vi.fn(), updateMany: vi.fn() },
    survey: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

/**
 * How these queries behave against a real database (ordering, paging, scoping, the race) is proven in
 * `exemptions-service.integration.test.ts`. These pin the decisions made in code around them.
 */
const statement = (call: unknown[]) => {
  const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql.replace(/\s+/g, " "), values: sql.values };
};

const ORG_ID = "clorg11111111111111111111";
const USER_ID = "cluser1111111111111111111";
const NOW = new Date("2030-01-02T00:00:00.000Z");
const MEMBER = { enforced: true, isOrganizationAdmin: false, kind: "user", userId: USER_ID } as const;

const uniqueViolation = (fields: string[]) =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: fields },
  });

describe("exemption reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
  });

  test("reads nothing for a member with no workspace in the organisation", async () => {
    const scope = { kind: "surveys", workspaceIds: [], actorContext: MEMBER } as const;

    await expect(
      listRetentionExemptionKeysetPage({ organizationId: ORG_ID, scope, now: NOW, limit: 10, cursor: null })
    ).resolves.toEqual([]);
    await expect(findRetentionExemption({ id: "clexm", organizationId: ORG_ID, scope })).resolves.toBeNull();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test("lists active exemptions newest first, scoped to a member's workspaces and visible surveys", async () => {
    const cursor = { value: "2030-01-01T00:00:00.000Z", id: "clexm" };

    await listRetentionExemptionKeysetPage({
      organizationId: ORG_ID,
      scope: { kind: "surveys", workspaceIds: ["clwsp1", "clwsp2"], actorContext: MEMBER },
      now: NOW,
      limit: 10,
      cursor,
    });

    const { text, values } = statement(vi.mocked(prisma.$queryRaw).mock.calls[0]);
    expect(text).toContain('e."organizationId" = ? AND e."revokedAt" IS NULL AND e."until" > ?');
    expect(text).toContain('s."workspaceId" IN (?,?)');
    expect(text).toContain('OR "s"."ownerId" = ?');
    expect(text).toContain('(e."created_at", e."id") < (?, ?)');
    expect(text).toContain('ORDER BY e."created_at" DESC, e."id" DESC LIMIT ?');
    expect(values).toEqual([ORG_ID, NOW, "clwsp1", "clwsp2", USER_ID, new Date(cursor.value), cursor.id, 11]);
  });

  test("finds one exemption of the organisation with no survey filter for owners and managers", async () => {
    const row = { id: "clexm" };
    vi.mocked(prisma.$queryRaw).mockResolvedValue([row] as never);

    await expect(
      findRetentionExemption({ id: "clexm", organizationId: ORG_ID, scope: { kind: "organization" } })
    ).resolves.toBe(row);

    const { text, values } = statement(vi.mocked(prisma.$queryRaw).mock.calls[0]);
    expect(text).toContain('WHERE e."id" = ? AND e."organizationId" = ? AND TRUE LIMIT 1');
    expect(values).toEqual(["clexm", ORG_ID]);
  });

  test("resolves the organisation of an exemption and of a survey", async () => {
    vi.mocked(prisma.retentionExemption.findUnique).mockResolvedValueOnce({
      organizationId: ORG_ID,
    } as never);
    vi.mocked(prisma.survey.findUnique).mockResolvedValueOnce({
      id: "clsrv",
      name: "Site visit",
      workspace: { organizationId: ORG_ID },
    } as never);

    await expect(getRetentionExemptionOrganizationId("clexm")).resolves.toBe(ORG_ID);
    await expect(getRetentionExemptionOrganizationId("missing")).resolves.toBeNull();
    await expect(getRetentionExemptionSurvey("clsrv")).resolves.toEqual({
      id: "clsrv",
      name: "Site visit",
      organizationId: ORG_ID,
    });
    await expect(getRetentionExemptionSurvey("missing")).resolves.toBeNull();
  });

  test("searches survey names literally, so a wildcard in the search matches only itself", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([
      { id: "clsrv", name: "100% done", workspace: { name: "Europe" } },
    ] as never);

    await expect(
      searchRetentionExemptionSurveys({ organizationId: ORG_ID, search: "100%", limit: 5 })
    ).resolves.toEqual([{ id: "clsrv", name: "100% done", workspaceName: "Europe" }]);
    expect(prisma.survey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspace: { organizationId: ORG_ID },
          name: { contains: String.raw`100\%`, mode: "insensitive" },
        },
        take: 5,
      })
    );

    await searchRetentionExemptionSurveys({ organizationId: ORG_ID, search: "", limit: 5 });
    expect(vi.mocked(prisma.survey.findMany).mock.lastCall?.[0]?.where).toEqual({
      workspace: { organizationId: ORG_ID },
    });
  });
});

describe("exemption writes", () => {
  const input = {
    organizationId: ORG_ID,
    surveyId: "clsrv",
    entity: "surveys" as const,
    until: new Date("2031-01-01T00:00:00.000Z"),
    reason: "Audit",
    createdById: USER_ID,
    now: NOW,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("closes an ended exemption before inserting, in one transaction", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      retentionExemption: { create: vi.fn().mockResolvedValue({ id: "clexm" }) },
    };
    vi.mocked(prisma.$transaction).mockImplementation(((run: (client: typeof tx) => unknown) =>
      run(tx)) as never);

    await expect(createRetentionExemption(input)).resolves.toEqual({ id: "clexm" });

    const { text, values } = statement(tx.$executeRaw.mock.calls[0]);
    expect(text).toContain('SET "revokedAt" = "until"');
    expect(text).toContain('"revokedAt" IS NULL AND "until" <= ?');
    expect(values).toEqual(["clsrv", "surveys", NOW]);
    expect(tx.retentionExemption.create).toHaveBeenCalledWith({
      data: {
        organizationId: ORG_ID,
        surveyId: "clsrv",
        entity: "surveys",
        until: input.until,
        reason: "Audit",
        createdById: USER_ID,
      },
      select: { id: true },
    });
  });

  test("reports a violation of the active-exemption index as an existing exemption", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(uniqueViolation(["surveyId", "entity"]));

    await expect(createRetentionExemption(input)).rejects.toBeInstanceOf(RetentionExemptionExistsError);
  });

  test("lets any other failure through, including a different unique violation", async () => {
    const other = uniqueViolation(["id"]);
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(other);
    await expect(createRetentionExemption(input)).rejects.toBe(other);

    const broken = new Error("connection lost");
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(broken);
    await expect(createRetentionExemption(input)).rejects.toBe(broken);
  });

  test("revokes only an exemption that is still active, and says whether it did", async () => {
    vi.mocked(prisma.retentionExemption.updateMany)
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 0 } as never);

    await expect(revokeRetentionExemption({ id: "clexm", revokedById: USER_ID, now: NOW })).resolves.toBe(
      true
    );
    await expect(revokeRetentionExemption({ id: "clexm", revokedById: USER_ID, now: NOW })).resolves.toBe(
      false
    );
    expect(prisma.retentionExemption.updateMany).toHaveBeenCalledWith({
      where: { id: "clexm", revokedAt: null, until: { gt: NOW } },
      data: { revokedAt: NOW, revokedById: USER_ID },
    });
  });
});
