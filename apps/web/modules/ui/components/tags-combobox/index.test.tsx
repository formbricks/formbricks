import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TagsCombobox } from "./index";

// Mock components
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, size }: any) => (
    <button data-testid="button" onClick={onClick} data-size={size}>
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/command", () => ({
  Command: ({ children, filter }: any) => (
    <div data-testid="command" data-filter-fn={filter ? "true" : "false"}>
      {children}
    </div>
  ),
  CommandGroup: ({ children }: any) => <div data-testid="command-group">{children}</div>,
  CommandInput: ({ placeholder, value, onValueChange, onKeyDown }: any) => (
    <input
      data-testid="command-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      onKeyDown={onKeyDown}
    />
  ),
  CommandItem: ({ children, value, onSelect, className }: any) => (
    <div data-testid="command-item" data-value={value} onClick={() => onSelect(value)} className={className}>
      {children}
    </div>
  ),
  CommandList: ({ children }: any) => <div data-testid="command-list">{children}</div>,
}));

vi.mock("@/modules/ui/components/popover", () => ({
  Popover: ({ children, open }: any) => (
    <div data-testid="popover" data-open={open}>
      {children}
    </div>
  ),
  PopoverContent: ({ children, className }: any) => (
    <div data-testid="popover-content" className={className}>
      {children}
    </div>
  ),
  PopoverTrigger: ({ children, asChild }: any) => (
    <div data-testid="popover-trigger" data-as-child={asChild}>
      {children}
    </div>
  ),
}));

// Mock tolgee
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "environments.project.tags.add_tag": "Add tag",
        "environments.project.tags.search_tags": "Search tags",
        "environments.project.tags.add": "Add",
      };
      return translations[key] || key;
    },
  }),
}));

describe("TagsCombobox", () => {
  afterEach(() => {
    cleanup();
  });

  const mockTags = [
    { label: "Tag1", value: "tag1" },
    { label: "Tag2", value: "tag2" },
    { label: "Tag3", value: "tag3" },
  ];

  const mockCurrentTags = [{ label: "Tag1", value: "tag1" }];

  const mockProps = {
    tags: mockTags,
    currentTags: mockCurrentTags,
    addTag: vi.fn(),
    createTag: vi.fn(),
    searchValue: "",
    setSearchValue: vi.fn(),
    open: false,
    setOpen: vi.fn(),
  };

  test("renders with default props", () => {
    render(<TagsCombobox {...mockProps} />);

    expect(screen.getByTestId("popover")).toBeInTheDocument();
    expect(screen.getByTestId("popover-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("button")).toBeInTheDocument();
    expect(screen.getByTestId("button")).toHaveTextContent("Add tag");
  });

  test("renders popover content when open is true", () => {
    render(<TagsCombobox {...mockProps} open={true} />);

    expect(screen.getByTestId("popover")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("popover-content")).toBeInTheDocument();
    expect(screen.getByTestId("command")).toBeInTheDocument();
    expect(screen.getByTestId("command-input")).toBeInTheDocument();
    expect(screen.getByTestId("command-list")).toBeInTheDocument();
  });

  test("shows available tags excluding current tags", () => {
    render(<TagsCombobox {...mockProps} open={true} />);

    const commandItems = screen.getAllByTestId("command-item");
    expect(commandItems).toHaveLength(2); // Should show Tag2 and Tag3 but not Tag1 (which is in currentTags)
    expect(commandItems[0]).toHaveAttribute("data-value", "tag2");
    expect(commandItems[1]).toHaveAttribute("data-value", "tag3");
  });

  test("calls addTag when a tag is selected", async () => {
    const user = userEvent.setup();
    const addTagMock = vi.fn();
    const setOpenMock = vi.fn();

    render(<TagsCombobox {...mockProps} open={true} addTag={addTagMock} setOpen={setOpenMock} />);

    const tag2Item = screen.getAllByTestId("command-item")[0];
    await user.click(tag2Item);

    expect(addTagMock).toHaveBeenCalledWith("tag2");
    expect(setOpenMock).toHaveBeenCalledWith(false);
  });

  test("calls createTag when Enter is pressed with a new tag", async () => {
    const user = userEvent.setup();
    const createTagMock = vi.fn();

    render(<TagsCombobox {...mockProps} open={true} searchValue="NewTag" createTag={createTagMock} />);

    const input = screen.getByTestId("command-input");
    await user.type(input, "{enter}");

    expect(createTagMock).toHaveBeenCalledWith("NewTag");
  });

  test("doesn't show create option when searchValue matches existing tag", () => {
    render(<TagsCombobox {...mockProps} open={true} searchValue="Tag2" />);

    const commandItems = screen.getAllByTestId("command-item");
    expect(commandItems).toHaveLength(2); // Tag2 and Tag3
    expect(commandItems[0]).toHaveAttribute("data-value", "tag2");
    expect(screen.queryByRole("button", { name: /\+ Add Tag2/i })).not.toBeInTheDocument();
  });

  test("resets search value when closed", () => {
    const setSearchValueMock = vi.fn();
    const { rerender } = render(
      <TagsCombobox {...mockProps} open={true} searchValue="test" setSearchValue={setSearchValueMock} />
    );

    // Change to closed state
    rerender(
      <TagsCombobox {...mockProps} open={false} searchValue="test" setSearchValue={setSearchValueMock} />
    );

    expect(setSearchValueMock).toHaveBeenCalledWith("");
  });

  test("updates placeholder based on available tags", () => {
    // With available tags
    const { rerender } = render(<TagsCombobox {...mockProps} open={true} />);

    expect(screen.getByTestId("command-input")).toHaveAttribute("placeholder", "Search tags");

    // Without available tags
    rerender(<TagsCombobox {...mockProps} open={true} tags={[]} />);

    expect(screen.getByTestId("command-input")).toHaveAttribute("placeholder", "Add tag");
  });
});
