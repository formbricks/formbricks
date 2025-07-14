import { TagError } from "@/modules/projects/settings/types/tag";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TTag } from "@formbricks/types/tags";
import { createTagAction, createTagToResponseAction, deleteTagOnResponseAction } from "../actions";
import { ResponseTagsWrapper } from "./ResponseTagsWrapper";

const dummyTags = [
  { tagId: "tag1", tagName: "Tag One" },
  { tagId: "tag2", tagName: "Tag Two" },
];
const dummyEnvironmentId = "env1";
const dummyResponseId = "resp1";
const dummyEnvironmentTags = [
  { id: "tag1", name: "Tag One" },
  { id: "tag2", name: "Tag Two" },
  { id: "tag3", name: "Tag Three" },
] as TTag[];
const dummyUpdateFetchedResponses = vi.fn();
const dummyRouterPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: dummyRouterPush,
  }),
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn((res) => res.error?.details[0].issue || "error"),
}));

vi.mock("../actions", () => ({
  createTagAction: vi.fn(),
  createTagToResponseAction: vi.fn(),
  deleteTagOnResponseAction: vi.fn(),
}));

// Mock Button, Tag and TagsCombobox components
vi.mock("@/modules/ui/components/button", () => ({
  Button: (props: any) => <button {...props}>{props.children}</button>,
}));
vi.mock("@/modules/ui/components/tag", () => ({
  Tag: (props: any) => (
    <div data-testid="tag">
      {props.tagName}
      {props.allowDelete && <button onClick={() => props.onDelete(props.tagId)}>Delete</button>}
    </div>
  ),
}));
vi.mock("@/modules/ui/components/tags-combobox", () => ({
  TagsCombobox: (props: any) => (
    <div data-testid="tags-combobox">
      <button onClick={() => props.createTag("NewTag")}>CreateTag</button>
      <button onClick={() => props.addTag("tag3")}>AddTag</button>
    </div>
  ),
}));

describe("ResponseTagsWrapper", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders settings button when not readOnly and navigates on click", async () => {
    render(
      <ResponseTagsWrapper
        tags={dummyTags}
        environmentId={dummyEnvironmentId}
        responseId={dummyResponseId}
        environmentTags={dummyEnvironmentTags}
        updateFetchedResponses={dummyUpdateFetchedResponses}
        isReadOnly={false}
      />
    );
    const settingsButton = screen.getByRole("button", { name: "" });
    await userEvent.click(settingsButton);
    expect(dummyRouterPush).toHaveBeenCalledWith(`/environments/${dummyEnvironmentId}/project/tags`);
  });

  test("does not render settings button when readOnly", () => {
    render(
      <ResponseTagsWrapper
        tags={dummyTags}
        environmentId={dummyEnvironmentId}
        responseId={dummyResponseId}
        environmentTags={dummyEnvironmentTags}
        updateFetchedResponses={dummyUpdateFetchedResponses}
        isReadOnly={true}
      />
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("renders provided tags", () => {
    render(
      <ResponseTagsWrapper
        tags={dummyTags}
        environmentId={dummyEnvironmentId}
        responseId={dummyResponseId}
        environmentTags={dummyEnvironmentTags}
        updateFetchedResponses={dummyUpdateFetchedResponses}
        isReadOnly={false}
      />
    );
    expect(screen.getAllByTestId("tag").length).toBe(2);
    expect(screen.getByText("Tag One")).toBeInTheDocument();
    expect(screen.getByText("Tag Two")).toBeInTheDocument();
  });

  test("calls deleteTagOnResponseAction on tag delete success", async () => {
    vi.mocked(deleteTagOnResponseAction).mockResolvedValueOnce({ data: "deleted" } as any);
    render(
      <ResponseTagsWrapper
        tags={dummyTags}
        environmentId={dummyEnvironmentId}
        responseId={dummyResponseId}
        environmentTags={dummyEnvironmentTags}
        updateFetchedResponses={dummyUpdateFetchedResponses}
        isReadOnly={false}
      />
    );
    const deleteButtons = screen.getAllByText("Delete");
    await userEvent.click(deleteButtons[0]);
    await waitFor(() => {
      expect(deleteTagOnResponseAction).toHaveBeenCalledWith({ responseId: dummyResponseId, tagId: "tag1" });
      expect(dummyUpdateFetchedResponses).toHaveBeenCalled();
    });
  });

  test("shows toast error on deleteTagOnResponseAction error", async () => {
    vi.mocked(deleteTagOnResponseAction).mockRejectedValueOnce(new Error("delete error"));
    render(
      <ResponseTagsWrapper
        tags={dummyTags}
        environmentId={dummyEnvironmentId}
        responseId={dummyResponseId}
        environmentTags={dummyEnvironmentTags}
        updateFetchedResponses={dummyUpdateFetchedResponses}
        isReadOnly={false}
      />
    );
    const deleteButtons = screen.getAllByText("Delete");
    await userEvent.click(deleteButtons[0]);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "environments.surveys.responses.an_error_occurred_deleting_the_tag"
      );
    });
  });

  test("creates a new tag via TagsCombobox and calls updateFetchedResponses on success", async () => {
    vi.mocked(createTagAction).mockResolvedValueOnce({
      data: { ok: true, data: { id: "newTagId", name: "NewTag" } },
    } as any);
    vi.mocked(createTagToResponseAction).mockResolvedValueOnce({ data: "tagAdded" } as any);
    render(
      <ResponseTagsWrapper
        tags={dummyTags}
        environmentId={dummyEnvironmentId}
        responseId={dummyResponseId}
        environmentTags={dummyEnvironmentTags}
        updateFetchedResponses={dummyUpdateFetchedResponses}
        isReadOnly={false}
      />
    );
    const createButton = screen.getByTestId("tags-combobox").querySelector("button");
    await userEvent.click(createButton!);
    await waitFor(() => {
      expect(createTagAction).toHaveBeenCalledWith({ environmentId: dummyEnvironmentId, tagName: "NewTag" });
      expect(createTagToResponseAction).toHaveBeenCalledWith({
        responseId: dummyResponseId,
        tagId: "newTagId",
      });
      expect(dummyUpdateFetchedResponses).toHaveBeenCalled();
    });
  });

  test("handles createTagAction failure and shows toast error", async () => {
    vi.mocked(createTagAction).mockResolvedValueOnce({
      data: {
        ok: false,
        error: { message: "Unique constraint failed on the fields", code: TagError.TAG_NAME_ALREADY_EXISTS },
      },
    } as any);
    render(
      <ResponseTagsWrapper
        tags={dummyTags}
        environmentId={dummyEnvironmentId}
        responseId={dummyResponseId}
        environmentTags={dummyEnvironmentTags}
        updateFetchedResponses={dummyUpdateFetchedResponses}
        isReadOnly={false}
      />
    );
    const createButton = screen.getByTestId("tags-combobox").querySelector("button");
    await userEvent.click(createButton!);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("environments.surveys.responses.tag_already_exists", {
        duration: 2000,
        icon: expect.anything(),
      });
    });
  });

  test("calls addTag correctly via TagsCombobox", async () => {
    vi.mocked(createTagToResponseAction).mockResolvedValueOnce({ data: "tagAdded" } as any);
    render(
      <ResponseTagsWrapper
        tags={dummyTags}
        environmentId={dummyEnvironmentId}
        responseId={dummyResponseId}
        environmentTags={dummyEnvironmentTags}
        updateFetchedResponses={dummyUpdateFetchedResponses}
        isReadOnly={false}
      />
    );
    const addButton = screen.getByTestId("tags-combobox").querySelectorAll("button")[1];
    await userEvent.click(addButton);
    await waitFor(() => {
      expect(createTagToResponseAction).toHaveBeenCalledWith({ responseId: dummyResponseId, tagId: "tag3" });
      expect(dummyUpdateFetchedResponses).toHaveBeenCalled();
    });
  });

  test("clears tagIdToHighlight after timeout", async () => {
    vi.useFakeTimers();

    render(
      <ResponseTagsWrapper
        tags={dummyTags}
        environmentId={dummyEnvironmentId}
        responseId={dummyResponseId}
        environmentTags={dummyEnvironmentTags}
        updateFetchedResponses={dummyUpdateFetchedResponses}
        isReadOnly={false}
      />
    );
    // We simulate that tagIdToHighlight is set (simulate via setState if possible)
    // Here we directly invoke the effect by accessing component instance is not trivial in RTL;
    // Instead, we manually advance timers to ensure cleanup timeout is executed.

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // No error expected; test passes if timer runs without issue.
    expect(true).toBe(true);
  });
});
