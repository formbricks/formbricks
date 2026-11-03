import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { getV3LibraryFieldIdsByKey, resolveV3EmbeddedFieldLibraryKeys } from "./embedded-fields-library";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: { embeddedData: { findMany: vi.fn() } },
}));

const workspaceId = "clxx1234567890123456789012";
const planTierRow = {
  id: "clplantier00000000000000001",
  key: "plan_tier",
  name: "Plan tier",
  source: "ingested",
  dataType: "string",
  defaultValue: "free",
  locked: true,
};
const npsRow = {
  id: "clnpsscore00000000000000001",
  key: "nps_score",
  name: "NPS score",
  source: "computed",
  dataType: "number",
  defaultValue: 0,
  locked: false,
};

describe("resolveV3EmbeddedFieldLibraryKeys (ENG-6930)", () => {
  beforeEach(() => {
    vi.mocked(prisma.embeddedData.findMany).mockReset();
    vi.mocked(prisma.embeddedData.findMany).mockResolvedValue([planTierRow, npsRow] as never);
  });

  test("fills a library entry sent by key alone with the library's definition", async () => {
    const result = await resolveV3EmbeddedFieldLibraryKeys(workspaceId, {
      name: "Renamed",
      embeddedFields: [{ key: "plan_tier" }, { name: "score", source: "computed" }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input).toEqual({
      name: "Renamed",
      embeddedFields: [
        {
          storageKey: "plan_tier",
          key: "plan_tier",
          name: "Plan tier",
          source: "ingested",
          dataType: "string",
          defaultValue: "free",
          locked: true,
        },
        { name: "score", source: "computed" },
      ],
    });
    // Tenancy: the lookup is scoped to the survey's workspace, never to the key alone.
    expect(prisma.embeddedData.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId, key: { in: ["plan_tier"] } } })
    );
  });

  test("replaces a definition the payload claims with the library's, keeping the storage key", async () => {
    const result = await resolveV3EmbeddedFieldLibraryKeys(workspaceId, {
      embeddedFields: [{ key: "plan_tier", storageKey: "plan", name: "Mine", locked: false }],
    });

    expect(result.ok && (result.input as { embeddedFields: unknown[] }).embeddedFields[0]).toMatchObject({
      storageKey: "plan",
      name: "Plan tier",
      locked: true,
    });
  });

  test("keeps the address an already linked computed library field has", async () => {
    const current: TLinkedEmbeddedField[] = [
      {
        field: { ...npsRow, source: "computed", dataType: "number" },
        link: { storageKey: "clnpslink000000000000000001" },
      },
    ];
    const result = await resolveV3EmbeddedFieldLibraryKeys(
      workspaceId,
      { embeddedFields: [{ key: "nps_score" }] },
      current
    );

    expect(result.ok && (result.input as { embeddedFields: unknown[] }).embeddedFields[0]).toMatchObject({
      storageKey: "clnpslink000000000000000001",
      source: "computed",
    });
  });

  test("refuses a key the workspace library does not have, at its path", async () => {
    const result = await resolveV3EmbeddedFieldLibraryKeys(workspaceId, {
      embeddedFields: [{ name: "a", source: "computed" }, { key: "churn_risk" }],
    });

    expect(result).toEqual({
      ok: false,
      invalidParams: [expect.objectContaining({ name: "embeddedFields.1.key", identifier: "churn_risk" })],
    });
  });

  test("refuses a library entry claiming the other source", async () => {
    const result = await resolveV3EmbeddedFieldLibraryKeys(workspaceId, {
      embeddedFields: [{ key: "plan_tier", source: "computed" }],
    });

    expect(result.ok ? [] : result.invalidParams.map((param) => param.name)).toEqual([
      "embeddedFields.0.source",
    ]);
  });

  test("does not query when no entry links a library key", async () => {
    const result = await resolveV3EmbeddedFieldLibraryKeys(workspaceId, { variables: [] });

    expect(result.ok).toBe(true);
    expect(prisma.embeddedData.findMany).not.toHaveBeenCalled();
  });
});

describe("getV3LibraryFieldIdsByKey", () => {
  test("maps each linked key to its row in the workspace", async () => {
    vi.mocked(prisma.embeddedData.findMany).mockResolvedValue([
      { id: planTierRow.id, key: "plan_tier" },
    ] as never);

    const ids = await getV3LibraryFieldIdsByKey(prisma, workspaceId, [
      {
        storageKey: "plan_tier",
        key: "plan_tier",
        name: "x",
        source: "ingested",
        dataType: "string",
        defaultValue: null,
        locked: false,
      },
    ]);

    expect([...ids]).toEqual([["plan_tier", planTierRow.id]]);
  });
});
