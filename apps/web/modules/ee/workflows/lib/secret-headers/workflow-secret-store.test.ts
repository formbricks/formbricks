import { beforeEach, describe, expect, test, vi } from "vitest";
import { symmetricDecrypt, symmetricEncrypt } from "@/lib/crypto";
import { loadWorkflowSecretValues, workflowSecretStore } from "./workflow-secret-store";

const KEY = vi.hoisted(() => "0123456789abcdef0123456789abcdef");

const prismaMock = vi.hoisted(() => ({
  workflowSecret: {
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  workflowVersion: { findMany: vi.fn() },
}));

vi.mock("@formbricks/database", () => ({ prisma: prismaMock }));
vi.mock("@/lib/constants", () => ({ ENCRYPTION_KEY: KEY }));

const scope = { workflowId: "wf_1", workspaceId: "ws_1" };
const API = "https://api.example.com";
const NEW_API = "https://new-api.example.com";

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
  test("stores the value encrypted, never as written, with the origin it was set for", async () => {
    prismaMock.workflowSecret.create.mockResolvedValue({ id: "sec_1" });

    const created = await workflowSecretStore.create({ ...scope, value: "sk_live_1", boundOrigin: API });

    expect(created).toEqual({ id: "sec_1" });
    const data = prismaMock.workflowSecret.create.mock.calls[0][0].data;
    expect(data.value).not.toContain("sk_live_1");
    expect(symmetricDecrypt(data.value as string, KEY)).toBe("sk_live_1");
    expect(data.boundOrigin).toBe(API);
  });

  test("Replace overwrites a row set for the same origin in place, and only within the workflow", async () => {
    prismaMock.workflowSecret.updateMany.mockResolvedValue({ count: 1 });

    const replaced = await workflowSecretStore.replace({
      ...scope,
      secretId: "sec_1",
      value: "rotated",
      boundOrigin: API,
    });

    expect(replaced).toEqual({ id: "sec_1" });
    const args = prismaMock.workflowSecret.updateMany.mock.calls[0][0];
    expect(args.where).toEqual({
      id: "sec_1",
      workflowId: "wf_1",
      workspaceId: "ws_1",
      OR: [{ boundOrigin: API }, { boundOrigin: null }],
    });
    expect(symmetricDecrypt(args.data.value as string, KEY)).toBe("rotated");
    expect(args.data.boundOrigin).toBe(API);
    expect(prismaMock.workflowSecret.create).not.toHaveBeenCalled();
  });

  test("Replace for another origin leaves the old row to its host and stores the value in a new row", async () => {
    prismaMock.workflowSecret.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.workflowSecret.findFirst.mockResolvedValue({ id: "sec_1" });
    prismaMock.workflowSecret.create.mockResolvedValue({ id: "sec_2" });

    const replaced = await workflowSecretStore.replace({
      ...scope,
      secretId: "sec_1",
      value: "new-key",
      boundOrigin: NEW_API,
    });

    expect(replaced).toEqual({ id: "sec_2" });
    const data = prismaMock.workflowSecret.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ workflowId: "wf_1", workspaceId: "ws_1", boundOrigin: NEW_API });
    expect(symmetricDecrypt(data.value as string, KEY)).toBe("new-key");
  });

  test("Replace of a secret the workflow does not own fails instead of creating one", async () => {
    prismaMock.workflowSecret.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.workflowSecret.findFirst.mockResolvedValue(null);

    await expect(
      workflowSecretStore.replace({ ...scope, secretId: "sec_x", value: "v", boundOrigin: API })
    ).rejects.toThrow();
    expect(prismaMock.workflowSecret.findFirst.mock.calls[0][0].where).toEqual({
      id: "sec_x",
      workflowId: "wf_1",
      workspaceId: "ws_1",
    });
    expect(prismaMock.workflowSecret.create).not.toHaveBeenCalled();
  });

  test("reads the origin each of the workflow's secrets was set for", async () => {
    prismaMock.workflowSecret.findMany.mockResolvedValue([
      { id: "sec_1", boundOrigin: API },
      { id: "sec_2", boundOrigin: null },
    ]);

    const origins = await workflowSecretStore.readBoundOrigins({ ...scope, secretIds: ["sec_1", "sec_2"] });

    expect(prismaMock.workflowSecret.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ["sec_1", "sec_2"] },
      workflowId: "wf_1",
      workspaceId: "ws_1",
    });
    expect(origins).toEqual(
      new Map([
        ["sec_1", API],
        ["sec_2", null],
      ])
    );
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
  test("decrypts the requested secrets of this workflow only, with the origin each was set for", async () => {
    prismaMock.workflowSecret.findMany.mockResolvedValue([
      { id: "sec_1", value: symmetricEncrypt("token-1", KEY), boundOrigin: API },
    ]);

    const values = await loadWorkflowSecretValues({ ...scope, secretIds: ["sec_1", "sec_2"] });

    expect(prismaMock.workflowSecret.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ["sec_1", "sec_2"] },
      workflowId: "wf_1",
      workspaceId: "ws_1",
    });
    expect(values).toEqual(new Map([["sec_1", { value: "token-1", boundOrigin: API }]]));
  });

  test("asks the database nothing when there is no secret to load", async () => {
    expect(await loadWorkflowSecretValues({ ...scope, secretIds: [] })).toEqual(new Map());
    expect(prismaMock.workflowSecret.findMany).not.toHaveBeenCalled();
  });
});
