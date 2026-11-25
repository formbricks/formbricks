import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import type { TIntegrationGoogleSheetsConfig } from "@formbricks/types/integration/google-sheet";
import { waitForBlockOn } from "@/integration/postgres-locks";
import { resetDb } from "@/integration/reset-db";
import { decryptIntegrationConfig } from "@/lib/integration/credentials";
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

const seedWorkspace = async (): Promise<{ workspaceId: string; surveyId: string }> => {
  const organization = await prisma.organization.create({ data: { name: "Integration race" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Integration race workspace", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: { name: "Survey", workspaceId: workspace.id, type: "link", status: "inProgress" },
  });
  return { workspaceId: workspace.id, surveyId: survey.id };
};

const seedWorkspaceWithIntegration = async (): Promise<{ workspaceId: string; surveyId: string }> => {
  const seeded = await seedWorkspace();
  await prisma.integration.create({
    data: {
      type: "googleSheets",
      workspaceId: seeded.workspaceId,
      config: { email: "sheets@example.com", key: key("stale"), data: [] },
    },
  });
  return seeded;
};

/**
 * Runs a credential write (a token refresh or an OAuth callback) and holds its transaction open until
 * `run` has put the settings save behind its lock, then commits it.
 */
const withOpenCredentialWrite = async (
  write: (tx: Prisma.TransactionClient) => Promise<unknown>,
  run: () => Promise<unknown>
): Promise<PromiseSettledResult<unknown>> => {
  let started!: Promise<PromiseSettledResult<unknown>>;
  await prisma.$transaction(
    async (tx) => {
      await write(tx);
      started = run().then(
        (value) => ({ status: "fulfilled", value }) as const,
        (reason: unknown) => ({ status: "rejected", reason }) as const
      );
      await waitForBlockOn(tx);
    },
    { timeout: 20_000 }
  );
  return started;
};

const storedConfig = async (workspaceId: string): Promise<TIntegrationGoogleSheetsConfig> => {
  const stored = await prisma.integration.findUniqueOrThrow({
    where: { type_workspaceId: { type: "googleSheets", workspaceId } },
  });
  // The row holds ciphertext (ENG-7311); read it the way the app does.
  return decryptIntegrationConfig("googleSheets", stored.config);
};

beforeEach(async () => {
  await resetDb();
});

describe("saveIntegrationKeepingStoredKey (real Postgres)", () => {
  test("a credential write that commits while the settings save is in flight keeps its fresh key", async () => {
    const { workspaceId, surveyId } = await seedWorkspaceWithIntegration();

    // A token refresh writing new credentials while the settings UI adds a mapping, sending back the
    // redacted credentials it was given.
    const save = await withOpenCredentialWrite(
      (tx) =>
        tx.integration.update({
          where: { type_workspaceId: { type: "googleSheets", workspaceId } },
          data: { config: { email: "sheets@example.com", key: key("fresh"), data: [] } },
        }),
      () =>
        saveIntegrationKeepingStoredKey(workspaceId, {
          type: "googleSheets",
          config: { email: "sheets@example.com", key: key(""), data: [mapping(surveyId)] },
        })
    );

    expect(save.status).toBe("fulfilled");
    const config = await storedConfig(workspaceId);
    expect(config.key.access_token).toBe("fresh");
    expect(config.key.refresh_token).toBe("refresh-fresh");
    expect(config.data.map((entry) => entry.surveyId)).toEqual([surveyId]);

    // The save encrypts the key it kept: the fresh token is not stored in plaintext.
    const raw = await prisma.integration.findUniqueOrThrow({
      where: { type_workspaceId: { type: "googleSheets", workspaceId } },
    });
    expect((raw.config as TIntegrationGoogleSheetsConfig).key.access_token).not.toBe("fresh");
  });

  test("a settings save with no stored row fails rather than overwrite a callback's new connection", async () => {
    const { workspaceId, surveyId } = await seedWorkspace();

    // An OAuth callback connecting the integration while a stale settings tab saves a mapping.
    const save = await withOpenCredentialWrite(
      (tx) =>
        tx.integration.create({
          data: {
            type: "googleSheets",
            workspaceId,
            config: { email: "sheets@example.com", key: key("fresh"), data: [] },
          },
        }),
      () =>
        saveIntegrationKeepingStoredKey(workspaceId, {
          type: "googleSheets",
          config: { email: "sheets@example.com", key: key(""), data: [mapping(surveyId)] },
        })
    );

    expect(save.status).toBe("rejected");
    expect(save.status === "rejected" && save.reason).toBeInstanceOf(DatabaseError);
    expect((await storedConfig(workspaceId)).key.access_token).toBe("fresh");
  });

  test("keeps the stored key when the client sends redacted credentials", async () => {
    const { workspaceId, surveyId } = await seedWorkspaceWithIntegration();

    await saveIntegrationKeepingStoredKey(workspaceId, {
      type: "googleSheets",
      config: { email: "sheets@example.com", key: key(""), data: [mapping(surveyId)] },
    });

    const config = await storedConfig(workspaceId);
    expect(config.key.access_token).toBe("stale");
    expect(config.data.map((entry) => entry.surveyId)).toEqual([surveyId]);
  });
});
