import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  addLegacyEnvironmentId,
  addLegacyEnvironmentIdBestEffort,
  addLegacyEnvironmentIdToList,
} from "./legacy-environment-id";

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn() },
}));

const findManyMock = vi.mocked(prisma.workspace.findMany);

describe("addLegacyEnvironmentIdToList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("uses the workspace's legacyEnvironmentId when the workspace was migrated", async () => {
    findManyMock.mockResolvedValue([{ id: "ws_1", legacyEnvironmentId: "env_1" }] as never);

    const result = await addLegacyEnvironmentIdToList([{ id: "survey_1", workspaceId: "ws_1" }]);

    expect(result).toEqual([{ id: "survey_1", workspaceId: "ws_1", environmentId: "env_1" }]);
  });

  test("falls back to the workspace id when there is no legacy environment id", async () => {
    findManyMock.mockResolvedValue([{ id: "ws_1", legacyEnvironmentId: null }] as never);

    const result = await addLegacyEnvironmentIdToList([{ id: "survey_1", workspaceId: "ws_1" }]);

    expect(result[0].environmentId).toBe("ws_1");
  });

  test("falls back to the workspace id when the workspace row is missing", async () => {
    findManyMock.mockResolvedValue([] as never);

    const result = await addLegacyEnvironmentIdToList([{ id: "survey_1", workspaceId: "ws_1" }]);

    expect(result[0].environmentId).toBe("ws_1");
  });

  test("resolves each entity against its own workspace and queries unique ids once", async () => {
    findManyMock.mockResolvedValue([
      { id: "ws_1", legacyEnvironmentId: "env_1" },
      { id: "ws_2", legacyEnvironmentId: "env_2" },
    ] as never);

    const result = await addLegacyEnvironmentIdToList([
      { id: "a", workspaceId: "ws_1" },
      { id: "b", workspaceId: "ws_2" },
      { id: "c", workspaceId: "ws_1" },
    ]);

    expect(result.map((entity) => entity.environmentId)).toEqual(["env_1", "env_2", "env_1"]);
    expect(findManyMock).toHaveBeenCalledTimes(1);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { id: { in: ["ws_1", "ws_2"] } },
      select: { id: true, legacyEnvironmentId: true },
    });
  });

  test("returns an empty list without querying", async () => {
    const result = await addLegacyEnvironmentIdToList([]);

    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

describe("addLegacyEnvironmentId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("adds environmentId to a single entity while preserving its other fields", async () => {
    findManyMock.mockResolvedValue([{ id: "ws_1", legacyEnvironmentId: "env_1" }] as never);

    const result = await addLegacyEnvironmentId({
      id: "webhook_1",
      workspaceId: "ws_1",
      url: "https://x.co",
    });

    expect(result).toEqual({
      id: "webhook_1",
      workspaceId: "ws_1",
      url: "https://x.co",
      environmentId: "env_1",
    });
  });

  test("propagates lookup failures so a wrong id is never handed to a client", async () => {
    findManyMock.mockRejectedValue(new Error("connection lost"));

    await expect(addLegacyEnvironmentId({ id: "survey_1", workspaceId: "ws_1" })).rejects.toThrow(
      "connection lost"
    );
  });
});

describe("addLegacyEnvironmentIdBestEffort", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("enriches like addLegacyEnvironmentId when the lookup succeeds", async () => {
    findManyMock.mockResolvedValue([{ id: "ws_1", legacyEnvironmentId: "env_1" }] as never);

    const result = await addLegacyEnvironmentIdBestEffort({ id: "webhook_1", workspaceId: "ws_1" });

    expect(result).toEqual({ id: "webhook_1", workspaceId: "ws_1", environmentId: "env_1" });
  });

  test("returns the un-enriched entity when the lookup throws, so a committed write still reports success", async () => {
    findManyMock.mockRejectedValue(new Error("connection lost"));

    const result = await addLegacyEnvironmentIdBestEffort({ id: "webhook_1", workspaceId: "ws_1" });

    expect(result).toEqual({ id: "webhook_1", workspaceId: "ws_1" });
  });
});
