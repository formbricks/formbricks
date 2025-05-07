import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  deleteTagAction,
  mergeTagsAction,
  updateTagNameAction,
} from "@/modules/projects/settings/tags/actions";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TTag } from "@formbricks/types/tags";
import { SingleTag } from "./single-tag";

vi.mock("@/modules/ui/components/delete-dialog", () => ({
  DeleteDialog: ({ open, setOpen, onDelete }: any) =>
    open ? (
      <div data-testid="delete-dialog">
        <button data-testid="confirm-delete" onClick={onDelete}>
          Delete
        </button>
      </div>
    ) : null,
}));

vi.mock("@/modules/ui/components/loading-spinner", () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

vi.mock("@/modules/projects/settings/tags/components/merge-tags-combobox", () => ({
  MergeTagsCombobox: ({ tags, onSelect }: any) => (
    <div data-testid="merge-tags-combobox">
      {tags.map((t: any) => (
        <button key={t.value} onClick={() => onSelect(t.value)}>
          {t.label}
        </button>
      ))}
    </div>
  ),
}));

const mockRouter = { refresh: vi.fn() };

vi.mock("@/modules/projects/settings/tags/actions", () => ({
  updateTagNameAction: vi.fn(),
  deleteTagAction: vi.fn(),
  mergeTagsAction: vi.fn(),
}));
vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mockRouter }));

const baseTag: TTag = {
  id: "tag1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Tag 1",
  environmentId: "env1",
};

const environmentTags: TTag[] = [
  baseTag,
  { id: "tag2", createdAt: new Date(), updatedAt: new Date(), name: "Tag 2", environmentId: "env1" },
];

describe("SingleTag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  test("renders tag name and count", () => {
    render(
      <SingleTag tagId={baseTag.id} tagName={baseTag.name} tagCount={5} environmentTags={environmentTags} />
    );
    expect(screen.getByDisplayValue("Tag 1")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  test("shows loading spinner if tagCountLoading", () => {
    render(
      <SingleTag
        tagId={baseTag.id}
        tagName={baseTag.name}
        tagCountLoading={true}
        environmentTags={environmentTags}
      />
    );
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  test("calls updateTagNameAction and shows success toast on blur", async () => {
    render(<SingleTag tagId={baseTag.id} tagName={baseTag.name} environmentTags={environmentTags} />);
    const input = screen.getByDisplayValue("Tag 1");
    await userEvent.clear(input);
    await userEvent.type(input, "Tag 1 Updated");
    fireEvent.blur(input);
    expect(updateTagNameAction).toHaveBeenCalledWith({ tagId: baseTag.id, name: "Tag 1 Updated" });
  });

  test("shows error toast and sets error state if updateTagNameAction fails", async () => {
    vi.mocked(updateTagNameAction).mockResolvedValueOnce({ serverError: "Error occurred" });
    render(<SingleTag tagId={baseTag.id} tagName={baseTag.name} environmentTags={environmentTags} />);
    const input = screen.getByDisplayValue("Tag 1");
    fireEvent.blur(input);
  });

  test("shows merge tags combobox and calls mergeTagsAction", async () => {
    render(<SingleTag tagId={baseTag.id} tagName={baseTag.name} environmentTags={environmentTags} />);
    const mergeBtn = screen.getByText("Tag 2");
    await userEvent.click(mergeBtn);
    expect(mergeTagsAction).toHaveBeenCalledWith({ originalTagId: baseTag.id, newTagId: "tag2" });
  });

  test("shows error toast if mergeTagsAction fails", async () => {
    vi.mocked(mergeTagsAction).mockResolvedValueOnce({});
    render(<SingleTag tagId={baseTag.id} tagName={baseTag.name} environmentTags={environmentTags} />);
    const mergeBtn = screen.getByText("Tag 2");
    await userEvent.click(mergeBtn);
    expect(getFormattedErrorMessage).toHaveBeenCalled();
  });

  test("shows delete dialog and calls deleteTagAction on confirm", async () => {
    render(<SingleTag tagId={baseTag.id} tagName={baseTag.name} environmentTags={environmentTags} />);
    await userEvent.click(screen.getByText("common.delete"));
    expect(screen.getByTestId("delete-dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("confirm-delete"));
    expect(deleteTagAction).toHaveBeenCalledWith({ tagId: baseTag.id });
  });

  test("shows error toast if deleteTagAction fails", async () => {
    vi.mocked(deleteTagAction).mockResolvedValueOnce({});
    render(<SingleTag tagId={baseTag.id} tagName={baseTag.name} environmentTags={environmentTags} />);
    await userEvent.click(screen.getByText("common.delete"));
    await userEvent.click(screen.getByTestId("confirm-delete"));
    expect(getFormattedErrorMessage).toHaveBeenCalled();
  });

  test("does not render actions if isReadOnly", () => {
    render(
      <SingleTag tagId={baseTag.id} tagName={baseTag.name} environmentTags={environmentTags} isReadOnly />
    );
    expect(screen.queryByText("common.delete")).not.toBeInTheDocument();
    expect(screen.queryByTestId("merge-tags-combobox")).not.toBeInTheDocument();
  });
});
