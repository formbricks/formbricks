import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import {
  getEnvironmentIdFromResponseId,
  getOrganizationIdFromEnvironmentId,
  getOrganizationIdFromResponseId,
  getOrganizationIdFromResponseNoteId,
  getProjectIdFromEnvironmentId,
  getProjectIdFromResponseId,
  getProjectIdFromResponseNoteId,
} from "@/lib/utils/helper";
import { getTag } from "@/lib/utils/services";
import { describe, expect, test, vi } from "vitest";
import { deleteResponse, getResponse } from "@formbricks/lib/response/service";
import {
  createResponseNote,
  resolveResponseNote,
  updateResponseNote,
} from "@formbricks/lib/responseNote/service";
import { createTag } from "@formbricks/lib/tag/service";
import { addTagToRespone, deleteTagOnResponse } from "@formbricks/lib/tagOnResponse/service";
import {
  createResponseNoteAction,
  createTagAction,
  createTagToResponseAction,
  deleteResponseAction,
  deleteTagOnResponseAction,
  getResponseAction,
  resolveResponseNoteAction,
  updateResponseNoteAction,
} from "./actions";

// Dummy inputs and context
const dummyCtx = { user: { id: "user1" } };
const dummyTagInput = { environmentId: "env1", tagName: "tag1" };
const dummyTagToResponseInput = { responseId: "resp1", tagId: "tag1" };
const dummyResponseIdInput = { responseId: "resp1" };
const dummyResponseNoteInput = { responseNoteId: "note1", text: "Updated note" };
const dummyCreateNoteInput = { responseId: "resp1", text: "New note" };
const dummyGetResponseInput = { responseId: "resp1" };

// Mocks for external dependencies
vi.mock("@/lib/utils/action-client-middleware", () => ({
  checkAuthorizationUpdated: vi.fn(),
}));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromEnvironmentId: vi.fn(),
  getProjectIdFromEnvironmentId: vi.fn().mockResolvedValue("proj-env"),
  getOrganizationIdFromResponseId: vi.fn().mockResolvedValue("org-resp"),
  getOrganizationIdFromResponseNoteId: vi.fn().mockResolvedValue("org-resp-note"),
  getProjectIdFromResponseId: vi.fn().mockResolvedValue("proj-resp"),
  getProjectIdFromResponseNoteId: vi.fn().mockResolvedValue("proj-resp-note"),
  getEnvironmentIdFromResponseId: vi.fn(),
}));
vi.mock("@/lib/utils/services", () => ({
  getTag: vi.fn(),
}));
vi.mock("@formbricks/lib/response/service", () => ({
  deleteResponse: vi.fn().mockResolvedValue("deletedResponse"),
  getResponse: vi.fn().mockResolvedValue({ data: "responseData" }),
}));
vi.mock("@formbricks/lib/responseNote/service", () => ({
  createResponseNote: vi.fn().mockResolvedValue("createdNote"),
  updateResponseNote: vi.fn().mockResolvedValue("updatedNote"),
  resolveResponseNote: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/lib/tag/service", () => ({
  createTag: vi.fn().mockResolvedValue("createdTag"),
}));
vi.mock("@formbricks/lib/tagOnResponse/service", () => ({
  addTagToRespone: vi.fn().mockResolvedValue("tagAdded"),
  deleteTagOnResponse: vi.fn().mockResolvedValue("tagDeleted"),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    schema: () => ({
      action: (fn: any) => async (input: any) => {
        const { user, ...rest } = input;
        return fn({
          parsedInput: rest,
          ctx: { user },
        });
      },
    }),
  },
}));

describe("createTagAction", () => {
  test("successfully creates a tag", async () => {
    vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);
    vi.mocked(getOrganizationIdFromEnvironmentId).mockResolvedValueOnce("org1");
    await createTagAction({ ...dummyTagInput, ...dummyCtx });
    expect(checkAuthorizationUpdated).toHaveBeenCalled();
    expect(getOrganizationIdFromEnvironmentId).toHaveBeenCalledWith(dummyTagInput.environmentId);
    expect(getProjectIdFromEnvironmentId).toHaveBeenCalledWith(dummyTagInput.environmentId);
    expect(createTag).toHaveBeenCalledWith(dummyTagInput.environmentId, dummyTagInput.tagName);
  });
});

describe("createTagToResponseAction", () => {
  test("adds tag to response when environments match", async () => {
    vi.mocked(getEnvironmentIdFromResponseId).mockResolvedValueOnce("env1");
    vi.mocked(getTag).mockResolvedValueOnce({ environmentId: "env1" });
    await createTagToResponseAction({ ...dummyTagToResponseInput, ...dummyCtx });
    expect(getEnvironmentIdFromResponseId).toHaveBeenCalledWith(dummyTagToResponseInput.responseId);
    expect(getTag).toHaveBeenCalledWith(dummyTagToResponseInput.tagId);
    expect(checkAuthorizationUpdated).toHaveBeenCalled();
    expect(addTagToRespone).toHaveBeenCalledWith(
      dummyTagToResponseInput.responseId,
      dummyTagToResponseInput.tagId
    );
  });

  test("throws error when environments do not match", async () => {
    vi.mocked(getEnvironmentIdFromResponseId).mockResolvedValueOnce("env1");
    vi.mocked(getTag).mockResolvedValueOnce({ environmentId: "differentEnv" });
    await expect(createTagToResponseAction({ ...dummyTagToResponseInput, ...dummyCtx })).rejects.toThrow(
      "Response and tag are not in the same environment"
    );
  });
});

describe("deleteTagOnResponseAction", () => {
  test("deletes tag on response when environments match", async () => {
    vi.mocked(getEnvironmentIdFromResponseId).mockResolvedValueOnce("env1");
    vi.mocked(getTag).mockResolvedValueOnce({ environmentId: "env1" });
    await deleteTagOnResponseAction({ ...dummyTagToResponseInput, ...dummyCtx });
    expect(getOrganizationIdFromResponseId).toHaveBeenCalledWith(dummyTagToResponseInput.responseId);
    expect(getTag).toHaveBeenCalledWith(dummyTagToResponseInput.tagId);
    expect(checkAuthorizationUpdated).toHaveBeenCalled();
    expect(deleteTagOnResponse).toHaveBeenCalledWith(
      dummyTagToResponseInput.responseId,
      dummyTagToResponseInput.tagId
    );
  });

  test("throws error when environments do not match", async () => {
    vi.mocked(getEnvironmentIdFromResponseId).mockResolvedValueOnce("env1");
    vi.mocked(getTag).mockResolvedValueOnce({ environmentId: "differentEnv" });
    await expect(deleteTagOnResponseAction({ ...dummyTagToResponseInput, ...dummyCtx })).rejects.toThrow(
      "Response and tag are not in the same environment"
    );
  });
});

describe("deleteResponseAction", () => {
  test("deletes response successfully", async () => {
    vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);
    await deleteResponseAction({ ...dummyResponseIdInput, ...dummyCtx });
    expect(checkAuthorizationUpdated).toHaveBeenCalled();
    expect(getOrganizationIdFromResponseId).toHaveBeenCalledWith(dummyResponseIdInput.responseId);
    expect(getProjectIdFromResponseId).toHaveBeenCalledWith(dummyResponseIdInput.responseId);
    expect(deleteResponse).toHaveBeenCalledWith(dummyResponseIdInput.responseId);
  });
});

describe("updateResponseNoteAction", () => {
  test("updates response note successfully", async () => {
    vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);
    await updateResponseNoteAction({ ...dummyResponseNoteInput, ...dummyCtx });
    expect(checkAuthorizationUpdated).toHaveBeenCalled();
    expect(getOrganizationIdFromResponseNoteId).toHaveBeenCalledWith(dummyResponseNoteInput.responseNoteId);
    expect(getProjectIdFromResponseNoteId).toHaveBeenCalledWith(dummyResponseNoteInput.responseNoteId);
    expect(updateResponseNote).toHaveBeenCalledWith(
      dummyResponseNoteInput.responseNoteId,
      dummyResponseNoteInput.text
    );
  });
});

describe("resolveResponseNoteAction", () => {
  test("resolves response note successfully", async () => {
    vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);
    await resolveResponseNoteAction({ responseNoteId: "note1", ...dummyCtx });
    expect(checkAuthorizationUpdated).toHaveBeenCalled();
    expect(getOrganizationIdFromResponseNoteId).toHaveBeenCalledWith("note1");
    expect(getProjectIdFromResponseNoteId).toHaveBeenCalledWith("note1");
    expect(resolveResponseNote).toHaveBeenCalledWith("note1");
  });
});

describe("createResponseNoteAction", () => {
  test("creates a response note successfully", async () => {
    vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);
    await createResponseNoteAction({ ...dummyCreateNoteInput, ...dummyCtx });
    expect(checkAuthorizationUpdated).toHaveBeenCalled();
    expect(getOrganizationIdFromResponseId).toHaveBeenCalledWith(dummyCreateNoteInput.responseId);
    expect(getProjectIdFromResponseId).toHaveBeenCalledWith(dummyCreateNoteInput.responseId);
    expect(createResponseNote).toHaveBeenCalledWith(
      dummyCreateNoteInput.responseId,
      dummyCtx.user.id,
      dummyCreateNoteInput.text
    );
  });
});

describe("getResponseAction", () => {
  test("retrieves response successfully", async () => {
    vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(true);
    await getResponseAction({ ...dummyGetResponseInput, ...dummyCtx });
    expect(checkAuthorizationUpdated).toHaveBeenCalled();
    expect(getOrganizationIdFromResponseId).toHaveBeenCalledWith(dummyGetResponseInput.responseId);
    expect(getProjectIdFromResponseId).toHaveBeenCalledWith(dummyGetResponseInput.responseId);
    expect(getResponse).toHaveBeenCalledWith(dummyGetResponseInput.responseId);
  });
});
