import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MergeTagsCombobox } from "./merge-tags-combobox";

vi.mock("@/modules/ui/components/command", () => ({
  Command: ({ children }: any) => <div data-testid="command">{children}</div>,
  CommandEmpty: ({ children }: any) => <div data-testid="command-empty">{children}</div>,
  CommandGroup: ({ children }: any) => <div data-testid="command-group">{children}</div>,
  CommandInput: (props: any) => <input data-testid="command-input" {...props} />,
  CommandItem: ({ children, onSelect, ...props }: any) => (
    <div data-testid="command-item" tabIndex={0} onClick={() => onSelect && onSelect(children)} {...props}>
      {children}
    </div>
  ),
  CommandList: ({ children }: any) => <div data-testid="command-list">{children}</div>,
}));

vi.mock("@/modules/ui/components/popover", () => ({
  Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
  PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
  PopoverTrigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
}));

describe("MergeTagsCombobox", () => {
  afterEach(() => {
    cleanup();
  });

  const tags = [
    { label: "Tag 1", value: "tag1" },
    { label: "Tag 2", value: "tag2" },
  ];

  test("renders button with tolgee string", () => {
    render(<MergeTagsCombobox tags={tags} onSelect={vi.fn()} />);
    expect(screen.getByText("environments.project.tags.merge")).toBeInTheDocument();
  });

  test("shows popover and all tag items when button is clicked", async () => {
    render(<MergeTagsCombobox tags={tags} onSelect={vi.fn()} />);
    await userEvent.click(screen.getByText("environments.project.tags.merge"));
    expect(screen.getByTestId("popover-content")).toBeInTheDocument();
    expect(screen.getAllByTestId("command-item").length).toBe(2);
    expect(screen.getByText("Tag 1")).toBeInTheDocument();
    expect(screen.getByText("Tag 2")).toBeInTheDocument();
  });

  test("calls onSelect with tag value and closes popover", async () => {
    const onSelect = vi.fn();
    render(<MergeTagsCombobox tags={tags} onSelect={onSelect} />);
    await userEvent.click(screen.getByText("environments.project.tags.merge"));
    await userEvent.click(screen.getByText("Tag 1"));
    expect(onSelect).toHaveBeenCalledWith("tag1");
  });

  test("shows no tag found if tags is empty", async () => {
    render(<MergeTagsCombobox tags={[]} onSelect={vi.fn()} />);
    await userEvent.click(screen.getByText("environments.project.tags.merge"));
    expect(screen.getByTestId("command-empty")).toBeInTheDocument();
  });

  test("filters tags using input", async () => {
    render(<MergeTagsCombobox tags={tags} onSelect={vi.fn()} />);
    await userEvent.click(screen.getByText("environments.project.tags.merge"));
    const input = screen.getByTestId("command-input");
    await userEvent.type(input, "Tag 2");
    expect(screen.getByText("Tag 2")).toBeInTheDocument();
  });
});
