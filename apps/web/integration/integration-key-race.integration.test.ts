import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import type { TIntegrationGoogleSheetsConfig } from "@formbricks/types/integration/google-sheet";
import { resetDb } from "@/integration/reset-db";
import { saveIntegrationKeepingStoredKey } from "@/lib/integration/service";

/**
 * A settings save racing a credential write, against real Postgres (ENG-2123).
 *
 * The settings save keeps the stored `config.key`. It used to read that key, then write the whole
 * config back as a separate statement, so a token refresh or an OAuth callback committing in between was
 * overwritten with the key read before it, and the integration lost its fresh credentials. Only a real
 * database with both writes in flight can tell a key read under the row's lock from one read before it.
 */

const key = (accessToken: string): TIntegrationGoogleSheetsConfig["key"] => ({
  scope: "https://www.googleapis.com/auth/spreadsheets",
  token_type: "Bearer",
  expiry_date: 1_900_000_000_000,
  access_token: accessToken,
  refresh_token: `refresh-${accessToken}`,
});

const mapping = (surveyId: string) => ({
  spreadsheetId: "spreadsheet-1",
  spreadsheetName: "Responses",
  surveyId,
  surveyName: "Survey",
  elementIds: ["q1"],
  elements: "Question 1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
});

const seedWorkspaceWithIntegration = async (): Promise<{ workspaceId: string; surveyId: string }> => {
  const organization = await prisma.organization.create({ data: { name: "Integration race" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Integration race workspace", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: { name: "Survey", workspaceId: workspace.id, type: "link", status: "inProgress" },
  });
  await prisma.integration.create({
    data: {
      type: "googleSheets",
      workspaceId: workspace.id,
      config: { email: "sheets@example.com", key: key("stale"), data: [] },
    },
  });
  return { workspaceId: workspace.id, surveyId: survey.id };
};

/** Resolves once another connection is blocked waiting for a lock: the save, behind the open refresh. */
const waitForBlockedWriter = async (): Promise<void> => {
  for (let attempt = 0; attempt < 200; attempt++) {
    const [{ waiting }] = await prisma.$queryRaw<{ waiting: bigint }[]>`
      SELECT count(*) AS waiting FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
    `;
    if (waiting > 0n) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("the settings save never waited on the refresh's lock");
};

beforeEach(async () => {
  await resetDb();
});

describe("saveIntegrationKeepingStoredKey (real Postgres)", () => {
  test("a credential write that commits while the settings save is in flight keeps its fresh key", async () => {
    const { workspaceId, surveyId } = await seedWorkspaceWithIntegration();

    let releaseRefresh!: () => void;
    const refreshMayCommit = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    let refreshHoldsRow!: () => void;
    const rowLocked = new Promise<void>((resolve) => {
      refreshHoldsRow = resolve;
    });

    // A token refresh writing new credentials, held open so the save starts before it commits.
    const refresh = prisma.$transaction(
      async (tx) => {
        await tx.integration.update({
          where: { type_workspaceId: { type: "googleSheets", workspaceId } },
          data: { config: { email: "sheets@example.com", key: key("fresh"), data: [] } },
        });
        refreshHoldsRow();
        await refreshMayCommit;
      },
      { timeout: 20_000 }
    );
    await rowLocked;

    // The settings UI adds a mapping, sending back the redacted credentials it was given.
    const save = saveIntegrationKeepingStoredKey(workspaceId, {
      type: "googleSheets",
      config: { email: "sheets@example.com", key: key(""), data: [mapping(surveyId)] },
    });

    await waitForBlockedWriter();
    releaseRefresh();
    await Promise.all([refresh, save]);

    const stored = await prisma.integration.findUniqueOrThrow({
      where: { type_workspaceId: { type: "googleSheets", workspaceId } },
    });
    const config = stored.config as TIntegrationGoogleSheetsConfig;
    expect(config.key.access_token).toBe("fresh");
    expect(config.key.refresh_token).toBe("refresh-fresh");
    expect(config.data.map((entry) => entry.surveyId)).toEqual([surveyId]);
  });

  test("keeps the stored key when the client sends redacted credentials", async () => {
    const { workspaceId, surveyId } = await seedWorkspaceWithIntegration();

    await saveIntegrationKeepingStoredKey(workspaceId, {
      type: "googleSheets",
      config: { email: "sheets@example.com", key: key(""), data: [mapping(surveyId)] },
    });

    const stored = await prisma.integration.findUniqueOrThrow({
      where: { type_workspaceId: { type: "googleSheets", workspaceId } },
    });
    const config = stored.config as TIntegrationGoogleSheetsConfig;
    expect(config.key.access_token).toBe("stale");
    expect(config.data.map((entry) => entry.surveyId)).toEqual([surveyId]);
  });
});
