import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { type TAuthzedRelationship, getAuthzedClient } from "./client";
import { isAuthzedEnabled } from "./config";
import {
  SURVEY_VISIBILITY_LOCK_PREFIX,
  type TSurveyProjectionRow,
  diffSurveyRelationships,
  expectedSurveyRelationships,
  reconcileSurveyRelationships,
} from "./survey";

const client = {
  deleteRelationships: vi.fn(),
  readRelationships: vi.fn(),
  writeRelationships: vi.fn(),
};

const tx = {
  $executeRaw: vi.fn(),
  survey: { findUnique: vi.fn() },
};

vi.mock("@formbricks/database", () => ({
  prisma: { $transaction: vi.fn() },
}));
vi.mock("@formbricks/logger", () => ({ logger: { debug: vi.fn(), warn: vi.fn() } }));
vi.mock("./client", () => ({ getAuthzedClient: vi.fn() }));
vi.mock("./config", () => ({ isAuthzedEnabled: vi.fn() }));
vi.mock("./metrics", () => ({ recordAuthzedProjection: vi.fn() }));

const SURVEY_ID = "survey-id";
const WORKSPACE_ID = "workspace-id";

const row = (overrides: Partial<TSurveyProjectionRow> = {}): TSurveyProjectionRow => ({
  id: SURVEY_ID,
  ownerId: "owner-id",
  visibility: "workspace",
  visibilityVersion: 3,
  workspaceId: WORKSPACE_ID,
  ...overrides,
});

const edge = (
  relation: string,
  objectType: "user" | "workspace",
  objectId: string
): TAuthzedRelationship => ({
  relation,
  resource: { objectId: SURVEY_ID, objectType: "survey" },
  subject: { objectId, objectType },
});

const observe = (relationships: ReadonlyArray<TAuthzedRelationship>): void => {
  client.readRelationships.mockResolvedValue({
    cursor: null,
    relationships,
    snapshot: relationships.length > 0 ? { token: "revision" } : null,
  });
};

/** The raw SQL a `$executeRaw` tagged-template call was given, with its bound values. */
const executedSql = (): ReadonlyArray<Readonly<{ sql: string; values: ReadonlyArray<unknown> }>> =>
  tx.$executeRaw.mock.calls.map((call: unknown[]) => {
    const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
    return { sql: strings.join("?"), values };
  });

const writtenUpdates = () => client.writeRelationships.mock.calls.flatMap(([batch]) => batch);

describe("expectedSurveyRelationships", () => {
  test("a workspace-visible survey with an owner shares its workspace and names the owner", () => {
    expect(expectedSurveyRelationships(row())).toEqual([
      edge("workspace", "workspace", WORKSPACE_ID),
      edge("owner", "user", "owner-id"),
      edge("shared_workspace", "workspace", WORKSPACE_ID),
    ]);
  });

  test("a workspace-visible survey without an owner only carries its workspace edges", () => {
    expect(expectedSurveyRelationships(row({ ownerId: null }))).toEqual([
      edge("workspace", "workspace", WORKSPACE_ID),
      edge("shared_workspace", "workspace", WORKSPACE_ID),
    ]);
  });

  test("a restricted survey replaces the shared edge with the restricted owner", () => {
    expect(expectedSurveyRelationships(row({ visibility: "restricted" }))).toEqual([
      edge("workspace", "workspace", WORKSPACE_ID),
      edge("owner", "user", "owner-id"),
      edge("private_owner", "user", "owner-id"),
    ]);
  });

  test("an ownerless restricted survey is reachable only through the workspace administrators", () => {
    expect(expectedSurveyRelationships(row({ ownerId: null, visibility: "restricted" }))).toEqual([
      edge("workspace", "workspace", WORKSPACE_ID),
    ]);
  });
});

describe("diffSurveyRelationships", () => {
  test("touches every expected edge and deletes every other observed one", () => {
    const expected = expectedSurveyRelationships(row({ visibility: "restricted" }));
    const current = [edge("shared_workspace", "workspace", WORKSPACE_ID), edge("owner", "user", "owner-id")];

    expect(diffSurveyRelationships(current, expected)).toEqual([
      ...expected.map((relationship) => ({ operation: "touch", relationship })),
      { operation: "delete", relationship: edge("shared_workspace", "workspace", WORKSPACE_ID) },
    ]);
  });
});

describe("reconcileSurveyRelationships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAuthzedEnabled).mockReturnValue(true);
    vi.mocked(getAuthzedClient).mockReturnValue(client as unknown as ReturnType<typeof getAuthzedClient>);
    vi.mocked(prisma.$transaction).mockImplementation((async (run: (value: typeof tx) => unknown) =>
      run(tx)) as never);
    client.deleteRelationships.mockResolvedValue(undefined);
    client.writeRelationships.mockResolvedValue(undefined);
    tx.$executeRaw.mockResolvedValue(1);
    tx.survey.findUnique.mockResolvedValue(row());
    observe([]);
  });

  test("takes the per-survey lock before reading, then acknowledges the projected version", async () => {
    await expect(reconcileSurveyRelationships([SURVEY_ID])).resolves.toEqual({
      passes: 1,
      status: "projected",
    });

    const [lock, ack] = executedSql();
    expect(lock).toEqual({
      sql: "SELECT pg_advisory_xact_lock(hashtext(?))",
      values: [`${SURVEY_VISIBILITY_LOCK_PREFIX}${SURVEY_ID}`],
    });
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.survey.findUnique.mock.invocationCallOrder[0]
    );
    // Only this exact version, and never through Prisma's `update`, which would bump `updatedAt`.
    expect(ack.sql).toContain('SET "visibilityProjectedVersion" = ?');
    expect(ack.sql).toContain('"visibilityVersion" = ?');
    expect(ack.values).toEqual([3, SURVEY_ID, 3, 3]);
  });

  test("replaces a previous owner's edges with the current owner's", async () => {
    tx.survey.findUnique.mockResolvedValue(row({ ownerId: "new-owner", visibility: "restricted" }));
    observe([
      edge("workspace", "workspace", WORKSPACE_ID),
      edge("owner", "user", "old-owner"),
      edge("private_owner", "user", "old-owner"),
    ]);

    await reconcileSurveyRelationships([SURVEY_ID]);

    expect(writtenUpdates()).toEqual(
      expect.arrayContaining([
        { operation: "touch", relationship: edge("owner", "user", "new-owner") },
        { operation: "touch", relationship: edge("private_owner", "user", "new-owner") },
        { operation: "delete", relationship: edge("owner", "user", "old-owner") },
        { operation: "delete", relationship: edge("private_owner", "user", "old-owner") },
      ])
    );
  });

  test("removes every relationship of a survey whose row is gone, and acknowledges nothing", async () => {
    tx.survey.findUnique.mockResolvedValue(null);

    await expect(reconcileSurveyRelationships([SURVEY_ID])).resolves.toMatchObject({ status: "projected" });

    expect(client.deleteRelationships).toHaveBeenCalledWith({
      resourceId: SURVEY_ID,
      resourceType: "survey",
    });
    expect(client.writeRelationships).not.toHaveBeenCalled();
    expect(executedSql()).toHaveLength(1); // the lock only
  });

  test("does not acknowledge a row that moved during the pass, and fails once it keeps moving", async () => {
    let version = 0;
    tx.survey.findUnique.mockImplementation(async () => row({ ownerId: `owner-${(version++).toString()}` }));

    await expect(reconcileSurveyRelationships([SURVEY_ID])).resolves.toMatchObject({
      code: "authzed_projection_unstable",
      status: "failed",
    });
    expect(executedSql()).toHaveLength(1);
  });

  test("never reaches PostgreSQL while AuthZed is disabled", async () => {
    vi.mocked(isAuthzedEnabled).mockReturnValue(false);

    await expect(reconcileSurveyRelationships([SURVEY_ID])).resolves.toEqual({ status: "disabled" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("is a no-op for an empty target list", async () => {
    await expect(reconcileSurveyRelationships([])).resolves.toEqual({ passes: 0, status: "projected" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
