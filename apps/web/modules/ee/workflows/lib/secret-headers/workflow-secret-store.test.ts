import { beforeEach, describe, expect, test, vi } from "vitest";
import { symmetricDecrypt, symmetricEncrypt } from "@/lib/crypto";
import { loadWorkflowSecretValues, workflowSecretStore } from "./workflow-secret-store";

const KEY = vi.hoisted(() => "0123456789abcdef0123456789abcdef");

const prismaMock = vi.hoisted(() => ({
  workflowSecret: { create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  workflowVersion: { findMany: vi.fn() },
}));

vi.mock("@formbricks/database", () => ({ prisma: prismaMock }));
vi.mock("@/lib/constants", () => ({ ENCRYPTION_KEY: KEY }));

const scope = { workflowId: "wf_1", workspaceId: "ws_1" };

const versionWith = (secretId: string) => ({
  definition: {
    nodes: [
      {
        id: "call",
        type: "action",
        actionType: "http_request",
        config: { headers: [{ name: "Authorization", secret: true, secretId }] },
      },
    ],
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("workflowSecretStore", () => {
  test("stores the value encrypted, never as written", async () => {
    prismaMock.workflowSecret.create.mockResolvedValue({ id: "sec_1" });

    const created = await workflowSecretStore.create({ ...scope, value: "sk_live_1" });

    expect(created).toEqual({ id: "sec_1" });
    const stored = prismaMock.workflowSecret.create.mock.calls[0][0].data.value as string;
    expect(stored).not.toContain("sk_live_1");
    expect(symmetricDecrypt(stored, KEY)).toBe("sk_live_1");
  });

  test("Replace overwrites the row in place, and only within the workflow", async () => {
    prismaMock.workflowSecret.updateMany.mockResolvedValue({ count: 1 });

    await workflowSecretStore.replace({ ...scope, secretId: "sec_1", value: "rotated" });

    const args = prismaMock.workflowSecret.updateMany.mock.calls[0][0];
    expect(args.where).toEqual({ id: "sec_1", workflowId: "wf_1", workspaceId: "ws_1" });
    expect(symmetricDecrypt(args.data.value as string, KEY)).toBe("rotated");
  });

  test("Replace of a secret the workflow does not own fails instead of creating one", async () => {
    prismaMock.workflowSecret.updateMany.mockResolvedValue({ count: 0 });

    await expect(workflowSecretStore.replace({ ...scope, secretId: "sec_x", value: "v" })).rejects.toThrow();
  });

  test("deletes only the rows neither the draft nor any version references", async () => {
    prismaMock.workflowVersion.findMany.mockResolvedValue([versionWith("sec_old"), versionWith("sec_kept")]);
    prismaMock.workflowSecret.deleteMany.mockResolvedValue({ count: 1 });

    await workflowSecretStore.deleteUnreferenced({ ...scope, referencedSecretIds: ["sec_draft"] });

    const where = prismaMock.workflowSecret.deleteMany.mock.calls[0][0].where;
    expect(where.workflowId).toBe("wf_1");
    expect(where.workspaceId).toBe("ws_1");
    expect([...where.id.notIn].sort()).toEqual(["sec_draft", "sec_kept", "sec_old"]);
  });
});

describe("loadWorkflowSecretValues", () => {
  test("decrypts the requested secrets of this workflow only", async () => {
    prismaMock.workflowSecret.findMany.mockResolvedValue([
      { id: "sec_1", value: symmetricEncrypt("token-1", KEY) },
    ]);

    const values = await loadWorkflowSecretValues({ ...scope, secretIds: ["sec_1", "sec_2"] });

    expect(prismaMock.workflowSecret.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ["sec_1", "sec_2"] },
      workflowId: "wf_1",
      workspaceId: "ws_1",
    });
    expect(values).toEqual(new Map([["sec_1", "token-1"]]));
  });

  test("asks the database nothing when there is no secret to load", async () => {
    expect(await loadWorkflowSecretValues({ ...scope, secretIds: [] })).toEqual(new Map());
    expect(prismaMock.workflowSecret.findMany).not.toHaveBeenCalled();
  });
});
