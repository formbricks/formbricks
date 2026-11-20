import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MAX_EMBEDDED_FIELD_LABELS_PER_WORKSPACE } from "./embedded-field-label-limits";
import { getEmbeddedFieldLabels, setEmbeddedFieldLabel } from "./embedded-field-labels";

vi.mock("server-only", () => ({}));

const workspaceId = "clws111111111111111111111";
const row = { id: "row-1", key: "plan", label: "Subscription plan" };

beforeEach(() => {
  prisma.$transaction.mockImplementation(((fn: (tx: typeof prisma) => unknown) => fn(prisma)) as never);
  prisma.$queryRaw.mockResolvedValue([{ id: workspaceId }] as never);
});

describe("getEmbeddedFieldLabels", () => {
  test("reads nothing for no keys", async () => {
    await expect(getEmbeddedFieldLabels(workspaceId, [])).resolves.toEqual(new Map());
    expect(prisma.embeddedFieldLabel.findMany).not.toHaveBeenCalled();
  });

  test("reads only the workspace's names for the asked keys", async () => {
    prisma.embeddedFieldLabel.findMany.mockResolvedValue([
      { key: "plan", label: "Subscription plan" },
    ] as never);

    const labels = await getEmbeddedFieldLabels(workspaceId, ["plan", "tier", "plan"]);

    expect(labels).toEqual(new Map([["plan", "Subscription plan"]]));
    expect(prisma.embeddedFieldLabel.findMany).toHaveBeenCalledWith({
      where: { workspaceId, key: { in: ["plan", "tier"] } },
      select: { key: true, label: true },
    });
  });
});

describe("setEmbeddedFieldLabel", () => {
  test("answers workspaceGone when the workspace row no longer exists", async () => {
    prisma.$queryRaw.mockResolvedValue([] as never);
    await expect(
      setEmbeddedFieldLabel({ workspaceId, key: "plan", label: "X", expectedLabel: null })
    ).resolves.toEqual({
      kind: "workspaceGone",
    });
    expect(prisma.embeddedFieldLabel.create).not.toHaveBeenCalled();
  });

  test("creates a name for a key without one", async () => {
    prisma.embeddedFieldLabel.findUnique.mockResolvedValue(null);
    prisma.embeddedFieldLabel.count.mockResolvedValue(0);
    prisma.embeddedFieldLabel.create.mockResolvedValue(row as never);

    await expect(
      setEmbeddedFieldLabel({ workspaceId, key: "plan", label: "Subscription plan", expectedLabel: null })
    ).resolves.toEqual({ kind: "saved", previous: null, current: row });
    expect(prisma.embeddedFieldLabel.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { workspaceId, key: "plan", label: "Subscription plan" } })
    );
  });

  test("refuses a new name past the workspace cap, in the transaction that would write it", async () => {
    prisma.embeddedFieldLabel.findUnique.mockResolvedValue(null);
    prisma.embeddedFieldLabel.count.mockResolvedValue(MAX_EMBEDDED_FIELD_LABELS_PER_WORKSPACE);

    await expect(
      setEmbeddedFieldLabel({ workspaceId, key: "plan", label: "X", expectedLabel: null })
    ).resolves.toEqual({
      kind: "limitReached",
    });
    expect(prisma.embeddedFieldLabel.create).not.toHaveBeenCalled();
  });

  test("renames a key that already has a name even at the cap", async () => {
    prisma.embeddedFieldLabel.findUnique.mockResolvedValue(row as never);
    prisma.embeddedFieldLabel.update.mockResolvedValue({ ...row, label: "Plan tier" } as never);

    const result = await setEmbeddedFieldLabel({
      workspaceId,
      key: "plan",
      label: "Plan tier",
      expectedLabel: row.label,
    });

    expect(result).toEqual({ kind: "saved", previous: row, current: { ...row, label: "Plan tier" } });
    expect(prisma.embeddedFieldLabel.count).not.toHaveBeenCalled();
  });

  test("clearing deletes the row, and is a no-op for a key without one", async () => {
    prisma.embeddedFieldLabel.findUnique.mockResolvedValueOnce(row as never);
    await expect(
      setEmbeddedFieldLabel({ workspaceId, key: "plan", label: null, expectedLabel: row.label })
    ).resolves.toEqual({
      kind: "saved",
      previous: row,
      current: null,
    });
    expect(prisma.embeddedFieldLabel.delete).toHaveBeenCalledWith({ where: { id: "row-1" } });

    prisma.embeddedFieldLabel.findUnique.mockResolvedValueOnce(null);
    await setEmbeddedFieldLabel({ workspaceId, key: "plan", label: null, expectedLabel: null });
    expect(prisma.embeddedFieldLabel.delete).toHaveBeenCalledTimes(1);
  });

  test("refuses a stale rename: another editor's name is stored", async () => {
    prisma.embeddedFieldLabel.findUnique.mockResolvedValue(row as never);

    await expect(
      setEmbeddedFieldLabel({ workspaceId, key: "plan", label: "Tier", expectedLabel: null })
    ).resolves.toEqual({ kind: "stale", current: row });
    await expect(
      setEmbeddedFieldLabel({ workspaceId, key: "plan", label: null, expectedLabel: "Plan" })
    ).resolves.toEqual({ kind: "stale", current: row });
    expect(prisma.embeddedFieldLabel.update).not.toHaveBeenCalled();
    expect(prisma.embeddedFieldLabel.delete).not.toHaveBeenCalled();
  });

  test("asking for the name already stored is not stale", async () => {
    prisma.embeddedFieldLabel.findUnique.mockResolvedValue(row as never);
    await expect(
      setEmbeddedFieldLabel({ workspaceId, key: "plan", label: row.label, expectedLabel: null })
    ).resolves.toEqual({ kind: "saved", previous: row, current: row });
  });
});
