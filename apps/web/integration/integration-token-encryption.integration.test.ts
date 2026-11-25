import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { ENCRYPTION_KEY } from "@/lib/constants";
import { symmetricDecrypt } from "@/lib/crypto";
import { createOrUpdateIntegration, getIntegrationByType, getIntegrations } from "@/lib/integration/service";
// The data migration under test (auto-discovered by the migration runner).
import { backfillIntegrationTokens } from "../../../packages/database/migration/20261123120000_encrypt_integration_tokens/migration";

// Survey visibility (ENG-3282) is not enforced here: the readiness marker is off, not read from a database.
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: vi.fn(async () => false) }));

/**
 * ENG-7311 against real Postgres: Slack, Google Sheets and Airtable tokens are encrypted at rest, rows
 * written before the change keep working (no reconnect), and the backfill converts them in place.
 */
const SLACK_TOKEN = "xoxb-1234-5678-abcdefghijklmnop";
const GOOGLE_ACCESS = "ya29.a0AfH6SMBplaintextaccess";
const GOOGLE_REFRESH = "1//0gplaintextrefreshtoken";
const AIRTABLE_ACCESS = "oaaAAAplaintextaccess.v1.eyJ4IjoxfQ";
const AIRTABLE_REFRESH = "oaaBBBplaintextrefresh.v1.eyJ5IjoyfQ";

const ENCRYPTED_SHAPE = /^[0-9a-f]{32}:[0-9a-f]*:[0-9a-f]{32}$/;

const slackKey = (access_token: string) => ({
  app_id: "A1",
  authed_user: { id: "U1" },
  token_type: "bot" as const,
  access_token,
  bot_user_id: "B1",
  team: { id: "T1", name: "ACME" },
});
const googleKey = (access_token: string, refresh_token: string) => ({
  access_token,
  refresh_token,
  scope: "https://www.googleapis.com/auth/spreadsheets",
  token_type: "Bearer" as const,
  expiry_date: 4102444800000,
});
const airtableKey = (access_token: string, refresh_token: string) => ({
  access_token,
  refresh_token,
  expiry_date: "2100-01-01T00:00:00.000Z",
});

let workspaceId: string;

const rawKey = async (type: "slack" | "googleSheets" | "airtable") => {
  const row = await prisma.integration.findFirstOrThrow({ where: { workspaceId, type } });
  return (row.config as { key: Record<string, unknown> }).key;
};

/** A row exactly as the previous release's callbacks wrote it: plaintext tokens. */
const seedLegacyRows = async () => {
  await prisma.integration.createMany({
    data: [
      { type: "slack", workspaceId, config: { key: slackKey(SLACK_TOKEN), data: [] } },
      {
        type: "googleSheets",
        workspaceId,
        config: { key: googleKey(GOOGLE_ACCESS, GOOGLE_REFRESH), data: [], email: "a@b.co" },
      },
      {
        type: "airtable",
        workspaceId,
        config: { key: airtableKey(AIRTABLE_ACCESS, AIRTABLE_REFRESH), data: [], email: "a@b.co" },
      },
    ],
  });
};

beforeEach(async () => {
  await resetDb();
  const organization = await prisma.organization.create({
    data: {
      name: "ACME Inc.",
      billing: { create: { limits: { projects: null, monthly: { responses: null, miu: null } } } },
    },
  });
  const workspace = await prisma.workspace.create({
    data: { name: "Retail Banking", organizationId: organization.id },
  });
  workspaceId = workspace.id;
});

describe("integration token encryption (real Postgres)", () => {
  test("writing through the service stores ciphertext and the service reads plaintext back", async () => {
    await createOrUpdateIntegration(workspaceId, {
      type: "slack",
      config: { key: slackKey(SLACK_TOKEN), data: [] },
    });
    await createOrUpdateIntegration(workspaceId, {
      type: "googleSheets",
      config: { key: googleKey(GOOGLE_ACCESS, GOOGLE_REFRESH), data: [], email: "a@b.co" },
    });
    await createOrUpdateIntegration(workspaceId, {
      type: "airtable",
      config: { key: airtableKey(AIRTABLE_ACCESS, AIRTABLE_REFRESH), data: [], email: "a@b.co" },
    });

    const slack = await rawKey("slack");
    const google = await rawKey("googleSheets");
    const airtable = await rawKey("airtable");
    for (const stored of [
      slack.access_token,
      google.access_token,
      google.refresh_token,
      airtable.access_token,
      airtable.refresh_token,
    ]) {
      expect(stored).toMatch(ENCRYPTED_SHAPE);
    }
    // Everything else in the key stays readable metadata.
    expect(slack.team).toEqual({ id: "T1", name: "ACME" });
    expect(google.expiry_date).toBe(4102444800000);
    const dump = JSON.stringify(await prisma.integration.findMany({ where: { workspaceId } }));
    for (const secret of [SLACK_TOKEN, GOOGLE_ACCESS, GOOGLE_REFRESH, AIRTABLE_ACCESS, AIRTABLE_REFRESH]) {
      expect(dump).not.toContain(secret);
    }

    expect((await getIntegrationByType(workspaceId, "slack"))?.config.key).toMatchObject({
      access_token: SLACK_TOKEN,
    });
    expect((await getIntegrationByType(workspaceId, "googleSheets"))?.config.key).toMatchObject({
      access_token: GOOGLE_ACCESS,
      refresh_token: GOOGLE_REFRESH,
    });
    const all = await getIntegrations(workspaceId);
    expect(all.find((i) => i.type === "airtable")?.config.key).toMatchObject({
      access_token: AIRTABLE_ACCESS,
      refresh_token: AIRTABLE_REFRESH,
    });
  });

  test("a legacy plaintext row keeps working with no reconnect", async () => {
    await seedLegacyRows();

    expect((await getIntegrationByType(workspaceId, "slack"))?.config.key).toMatchObject({
      access_token: SLACK_TOKEN,
    });
    expect((await getIntegrationByType(workspaceId, "googleSheets"))?.config.key).toMatchObject({
      access_token: GOOGLE_ACCESS,
      refresh_token: GOOGLE_REFRESH,
    });
    // Still plaintext in the database: reading never rewrites.
    expect((await rawKey("slack")).access_token).toBe(SLACK_TOKEN);
  });

  test("re-saving a row read through the service encrypts it exactly once", async () => {
    await seedLegacyRows();
    const slack = await getIntegrationByType(workspaceId, "slack");
    await createOrUpdateIntegration(workspaceId, { type: "slack", config: slack!.config });
    await createOrUpdateIntegration(workspaceId, { type: "slack", config: slack!.config });

    const stored = (await rawKey("slack")).access_token as string;
    expect(stored).toMatch(ENCRYPTED_SHAPE);
    expect(symmetricDecrypt(stored, ENCRYPTION_KEY)).toBe(SLACK_TOKEN);
  });

  test("the backfill encrypts legacy rows in place, once, and the service still reads them", async () => {
    await seedLegacyRows();

    const first = await backfillIntegrationTokens(prisma, ENCRYPTION_KEY);
    expect(first).toMatchObject({ scanned: 3, updated: 3, skipped: [] });

    // The migration's own encryption is readable by the app's helper.
    expect(symmetricDecrypt((await rawKey("slack")).access_token as string, ENCRYPTION_KEY)).toBe(
      SLACK_TOKEN
    );
    expect(symmetricDecrypt((await rawKey("googleSheets")).refresh_token as string, ENCRYPTION_KEY)).toBe(
      GOOGLE_REFRESH
    );
    expect(await getIntegrationByType(workspaceId, "airtable")).toMatchObject({
      config: { key: { access_token: AIRTABLE_ACCESS, refresh_token: AIRTABLE_REFRESH } },
    });

    const before = JSON.stringify(
      await prisma.integration.findMany({ where: { workspaceId }, orderBy: { type: "asc" } })
    );
    expect(await backfillIntegrationTokens(prisma, ENCRYPTION_KEY)).toMatchObject({ scanned: 0, updated: 0 });
    expect(
      JSON.stringify(await prisma.integration.findMany({ where: { workspaceId }, orderBy: { type: "asc" } }))
    ).toBe(before);
  });

  test("the backfill leaves Notion, empty tokens and metadata alone", async () => {
    const notionKey = { access_token: "aa".repeat(16) + ":bb:" + "cc".repeat(16), bot_id: "bot" };
    await prisma.integration.create({
      data: { type: "notion", workspaceId, config: { key: notionKey, data: [] } },
    });
    await prisma.integration.create({
      data: {
        type: "googleSheets",
        workspaceId,
        config: { key: googleKey("", ""), data: [], email: "a@b.co" },
      },
    });

    expect(await backfillIntegrationTokens(prisma, ENCRYPTION_KEY)).toMatchObject({ scanned: 0, updated: 0 });
    const notion = await prisma.integration.findFirstOrThrow({ where: { workspaceId, type: "notion" } });
    expect((notion.config as { key: unknown }).key).toEqual(notionKey);
    expect(await rawKey("googleSheets")).toMatchObject({ access_token: "", refresh_token: "" });
  });

  test("the backfill refuses to run without a key when there is something to encrypt", async () => {
    await seedLegacyRows();
    await expect(backfillIntegrationTokens(prisma, undefined)).rejects.toThrow(/ENCRYPTION_KEY/);
    expect((await rawKey("slack")).access_token).toBe(SLACK_TOKEN);
  });

  test("a row an old pod refreshed during the backfill is re-read and encrypted, not overwritten", async () => {
    await seedLegacyRows();
    const row = await prisma.integration.findFirstOrThrow({ where: { workspaceId, type: "slack" } });
    // The old pod's refresh lands between the backfill's read and its write.
    const refreshed = { ...(row.config as object), key: slackKey("xoxb-refreshed-by-old-pod") };
    const realExecute = prisma.$executeRawUnsafe.bind(prisma);
    let raced = false;
    const spy = vi.spyOn(prisma, "$executeRawUnsafe").mockImplementation(((
      ...args: [string, ...unknown[]]
    ) => {
      if (!raced && args[0].startsWith('UPDATE "Integration"')) {
        raced = true;
        return realExecute(
          'UPDATE "Integration" SET "config" = $1::jsonb WHERE "id" = $2',
          JSON.stringify(refreshed),
          row.id
        ).then(() => realExecute(...args));
      }
      return realExecute(...args);
    }) as typeof prisma.$executeRawUnsafe);

    const stats = await backfillIntegrationTokens(prisma, ENCRYPTION_KEY);
    spy.mockRestore();

    expect(stats.raceRetries).toBeGreaterThanOrEqual(1);
    expect(stats.skipped).toEqual([]);
    expect(symmetricDecrypt((await rawKey("slack")).access_token as string, ENCRYPTION_KEY)).toBe(
      "xoxb-refreshed-by-old-pod"
    );
  });
});
