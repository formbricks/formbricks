import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getEnvironmentIdFromTagId } from "@/lib/utils/helper";
import { deleteTag, mergeTags, updateTagName } from "@/modules/projects/settings/lib/tag";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { deleteTagAction, mergeTagsAction, updateTagNameAction } from "./actions";

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    schema: () => ({
      action: (fn: any) => fn,
    }),
  },
}));
vi.mock("@/lib/utils/action-client-middleware", () => ({
  checkAuthorizationUpdated: vi.fn(),
}));
vi.mock("@/lib/utils/helper", () => ({
  getEnvironmentIdFromTagId: vi.fn(async (tagId: string) => tagId + "-env"),
  getOrganizationIdFromEnvironmentId: vi.fn(async (envId: string) => envId + "-org"),
  getOrganizationIdFromTagId: vi.fn(async (tagId: string) => tagId + "-org"),
  getProjectIdFromEnvironmentId: vi.fn(async (envId: string) => envId + "-proj"),
  getProjectIdFromTagId: vi.fn(async (tagId: string) => tagId + "-proj"),
}));
vi.mock("@/modules/projects/settings/lib/tag", () => ({
  deleteTag: vi.fn(async (tagId: string) => ({ deleted: tagId })),
  updateTagName: vi.fn(async (tagId: string, name: string) => ({ updated: tagId, name })),
  mergeTags: vi.fn(async (originalTagId: string, newTagId: string) => ({
    merged: [originalTagId, newTagId],
  })),
}));

const ctx = { user: { id: "user1" } };
const validTagId = "tag_123";
const validTagId2 = "tag_456";

describe("/modules/projects/settings/tags/actions.ts", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  test("deleteTagAction calls authorization and deleteTag", async () => {
    const result = await deleteTagAction({ ctx, parsedInput: { tagId: validTagId } } as any);
    expect(result).toEqual({ deleted: validTagId });
    expect(checkAuthorizationUpdated).toHaveBeenCalled();
    expect(deleteTag).toHaveBeenCalledWith(validTagId);
  });

  test("updateTagNameAction calls authorization and updateTagName", async () => {
    const name = "New Name";
    const result = await updateTagNameAction({ ctx, parsedInput: { tagId: validTagId, name } } as any);
    expect(result).toEqual({ updated: validTagId, name });
    expect(checkAuthorizationUpdated).toHaveBeenCalled();
    expect(updateTagName).toHaveBeenCalledWith(validTagId, name);
  });

  test("mergeTagsAction throws if tags are in different environments", async () => {
    vi.mocked(getEnvironmentIdFromTagId).mockImplementationOnce(async (id) => id + "-env1");
    vi.mocked(getEnvironmentIdFromTagId).mockImplementationOnce(async (id) => id + "-env2");
    await expect(
      mergeTagsAction({ ctx, parsedInput: { originalTagId: validTagId, newTagId: validTagId2 } } as any)
    ).rejects.toThrow("Tags must be in the same environment");
  });

  test("mergeTagsAction calls authorization and mergeTags if environments match", async () => {
    vi.mocked(getEnvironmentIdFromTagId).mockResolvedValue("env1");
    const result = await mergeTagsAction({
      ctx,
      parsedInput: { originalTagId: validTagId, newTagId: validTagId },
    } as any);
    expect(result).toEqual({ merged: [validTagId, validTagId] });
    expect(checkAuthorizationUpdated).toHaveBeenCalled();
    expect(mergeTags).toHaveBeenCalledWith(validTagId, validTagId);
  });
});
