import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { getTag, getTagsByWorkspaceId } from "@/lib/tag/service";
import { getTagsOnResponsesCount } from "@/lib/tagOnResponse/service";
import { deleteTag, mergeTags, updateTagName } from "@/modules/workspaces/settings/lib/tag";
import { deleteV3Tag, listV3Tags, mergeV3Tags, renameV3Tag } from "./operations";

vi.mock("server-only", () => ({}));

vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@/lib/tag/service", () => ({ getTag: vi.fn(), getTagsByWorkspaceId: vi.fn() }));
vi.mock("@/lib/tagOnResponse/service", () => ({ getTagsOnResponsesCount: vi.fn() }));
vi.mock("@/modules/workspaces/settings/lib/tag", () => ({
  deleteTag: vi.fn(),
  mergeTags: vi.fn(),
  updateTagName: vi.fn(),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

const workspaceId = "clxx1234567890123456789012";
const otherWorkspaceId = "clyy1234567890123456789012";
const organizationId = "clzz1234567890123456789012";
const tagId = "cltt1234567890123456789012";
const otherTagId = "cluu1234567890123456789012";

const tag = {
  id: tagId,
  name: "Bug report",
  workspaceId,
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
  updatedAt: new Date("2026-04-21T10:00:00.000Z"),
};

const base = { authentication: null, requestId: "req_1", instance: "/api/v3/tags" };

const grantAccess = () =>
  vi
    .mocked(requireV3WorkspaceAccess)
    .mockResolvedValue({ workspaceId, organizationId } as Awaited<
      ReturnType<typeof requireV3WorkspaceAccess>
    >);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listV3Tags", () => {
  test("joins each tag to its response count, defaulting to zero", async () => {
    grantAccess();
    vi.mocked(getTagsByWorkspaceId).mockResolvedValue([tag, { ...tag, id: otherTagId, name: "Churn" }]);
    vi.mocked(getTagsOnResponsesCount).mockResolvedValue([{ tagId, count: 7 }]);

    const response = await listV3Tags({ ...base, workspaceId });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({ id: tagId, name: "Bug report", count: 7 });
    // A tag nobody has applied still has to appear, with a zero rather than a missing count.
    expect(body.data[1]).toMatchObject({ id: otherTagId, count: 0 });
  });

  test("propagates the authorization failure instead of listing", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(new Response(null, { status: 403 }));

    const response = await listV3Tags({ ...base, workspaceId });

    expect(response.status).toBe(403);
    expect(getTagsByWorkspaceId).not.toHaveBeenCalled();
  });
});

describe("renameV3Tag", () => {
  test("renames a tag the caller may write to", async () => {
    vi.mocked(getTag).mockResolvedValue(tag);
    grantAccess();
    vi.mocked(updateTagName).mockResolvedValue({ ok: true, data: { ...tag, name: "Renamed" } } as Awaited<
      ReturnType<typeof updateTagName>
    >);

    const response = await renameV3Tag({ ...base, tagId, name: "Renamed" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ id: tagId, name: "Renamed" });
    expect(updateTagName).toHaveBeenCalledWith(tagId, "Renamed");
  });

  test("authorizes against the tag's own workspace, never a caller-supplied one", async () => {
    vi.mocked(getTag).mockResolvedValue(tag);
    grantAccess();
    vi.mocked(updateTagName).mockResolvedValue({ ok: true, data: tag } as Awaited<
      ReturnType<typeof updateTagName>
    >);

    await renameV3Tag({ ...base, tagId, name: "Renamed" });

    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      null,
      workspaceId,
      "readWrite",
      "req_1",
      "/api/v3/tags"
    );
  });

  test("403s an unknown tag, so tag ids cannot be probed for existence", async () => {
    vi.mocked(getTag).mockResolvedValue(null);

    const response = await renameV3Tag({ ...base, tagId, name: "Renamed" });

    expect(response.status).toBe(403);
    expect(requireV3WorkspaceAccess).not.toHaveBeenCalled();
    expect(updateTagName).not.toHaveBeenCalled();
  });

  test("surfaces a duplicate name as 422 rather than a server fault", async () => {
    vi.mocked(getTag).mockResolvedValue(tag);
    grantAccess();
    vi.mocked(updateTagName).mockResolvedValue({
      ok: false,
      error: { code: "tag_name_already_exists" },
    } as unknown as Awaited<ReturnType<typeof updateTagName>>);

    const response = await renameV3Tag({ ...base, tagId, name: "Bug report" });

    expect(response.status).toBe(422);
  });

  test("records the before and after objects for the audit log", async () => {
    vi.mocked(getTag).mockResolvedValue(tag);
    grantAccess();
    const renamed = { ...tag, name: "Renamed" };
    vi.mocked(updateTagName).mockResolvedValue({ ok: true, data: renamed } as Awaited<
      ReturnType<typeof updateTagName>
    >);
    const auditLog = {} as Parameters<typeof renameV3Tag>[0]["auditLog"];

    await renameV3Tag({ ...base, tagId, name: "Renamed", auditLog });

    expect(auditLog).toMatchObject({ organizationId, targetId: tagId, oldObject: tag, newObject: renamed });
  });
});

describe("deleteV3Tag", () => {
  test("deletes and reports the removed id", async () => {
    vi.mocked(getTag).mockResolvedValue(tag);
    grantAccess();
    vi.mocked(deleteTag).mockResolvedValue({ ok: true, data: tag } as Awaited<ReturnType<typeof deleteTag>>);

    const response = await deleteV3Tag({ ...base, tagId });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ id: tagId });
  });

  test("does not delete when authorization fails", async () => {
    vi.mocked(getTag).mockResolvedValue(tag);
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(new Response(null, { status: 403 }));

    const response = await deleteV3Tag({ ...base, tagId });

    expect(response.status).toBe(403);
    expect(deleteTag).not.toHaveBeenCalled();
  });

  test("records the removed tag for the audit log", async () => {
    vi.mocked(getTag).mockResolvedValue(tag);
    grantAccess();
    vi.mocked(deleteTag).mockResolvedValue({ ok: true, data: tag } as Awaited<ReturnType<typeof deleteTag>>);
    const auditLog = {} as Parameters<typeof deleteV3Tag>[0]["auditLog"];

    await deleteV3Tag({ ...base, tagId, auditLog });

    // A delete has no "after", so the removed row is the whole record of what happened.
    expect(auditLog).toMatchObject({ organizationId, targetId: tagId, oldObject: tag });
  });

  test("reports a failed delete as a server fault, not a success", async () => {
    vi.mocked(getTag).mockResolvedValue(tag);
    grantAccess();
    vi.mocked(deleteTag).mockResolvedValue({ ok: false, error: { code: "unexpected" } } as unknown as Awaited<
      ReturnType<typeof deleteTag>
    >);

    const response = await deleteV3Tag({ ...base, tagId });

    expect(response.status).toBe(500);
  });
});

describe("mergeV3Tags", () => {
  test("merges two tags in the same workspace", async () => {
    vi.mocked(getTag).mockImplementation(async (id: string) =>
      id === tagId ? tag : { ...tag, id: otherTagId, name: "Churn" }
    );
    grantAccess();
    vi.mocked(mergeTags).mockResolvedValue({ ok: true, data: tag } as Awaited<ReturnType<typeof mergeTags>>);

    const response = await mergeV3Tags({ ...base, tagId, newTagId: otherTagId });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ id: otherTagId });
    expect(mergeTags).toHaveBeenCalledWith(tagId, otherTagId);
  });

  test("refuses a cross-workspace merge, which would move responses across a tenant boundary", async () => {
    vi.mocked(getTag).mockImplementation(async (id: string) =>
      id === tagId ? tag : { ...tag, id: otherTagId, workspaceId: otherWorkspaceId }
    );
    grantAccess();

    const response = await mergeV3Tags({ ...base, tagId, newTagId: otherTagId });

    expect(response.status).toBe(403);
    expect(mergeTags).not.toHaveBeenCalled();
  });

  test("403s when the merge target does not exist, rather than confirming it is absent", async () => {
    vi.mocked(getTag).mockImplementation(async (id: string) => (id === tagId ? tag : null));
    grantAccess();

    const response = await mergeV3Tags({ ...base, tagId, newTagId: otherTagId });

    expect(response.status).toBe(403);
    expect(mergeTags).not.toHaveBeenCalled();
  });

  test("does not merge when authorization fails, and never loads the target", async () => {
    vi.mocked(getTag).mockResolvedValue(tag);
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(new Response(null, { status: 403 }));

    const response = await mergeV3Tags({ ...base, tagId, newTagId: otherTagId });

    expect(response.status).toBe(403);
    // Bailing before the second lookup is what stops a rejected caller probing the target's existence.
    expect(getTag).toHaveBeenCalledTimes(1);
    expect(mergeTags).not.toHaveBeenCalled();
  });

  test("records both tag ids and the source row for the audit log", async () => {
    const target = { ...tag, id: otherTagId, name: "Churn" };
    vi.mocked(getTag).mockImplementation(async (id: string) => (id === tagId ? tag : target));
    grantAccess();
    vi.mocked(mergeTags).mockResolvedValue({ ok: true, data: target } as Awaited<
      ReturnType<typeof mergeTags>
    >);
    const auditLog = {} as Parameters<typeof mergeV3Tags>[0]["auditLog"];

    await mergeV3Tags({ ...base, tagId, newTagId: otherTagId, auditLog });

    // A merge touches two rows, so the target id belongs in the audit trail alongside the source.
    expect(auditLog).toMatchObject({
      organizationId,
      targetId: `${tagId}-${otherTagId}`,
      oldObject: tag,
      newObject: target,
    });
  });

  test("reports a failed merge as a server fault, not a success", async () => {
    vi.mocked(getTag).mockImplementation(async (id: string) =>
      id === tagId ? tag : { ...tag, id: otherTagId }
    );
    grantAccess();
    vi.mocked(mergeTags).mockResolvedValue({ ok: false, error: { code: "unexpected" } } as unknown as Awaited<
      ReturnType<typeof mergeTags>
    >);

    const response = await mergeV3Tags({ ...base, tagId, newTagId: otherTagId });

    expect(response.status).toBe(500);
  });
});
