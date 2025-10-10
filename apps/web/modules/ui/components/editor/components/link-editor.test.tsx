import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LinkEditor } from "./link-editor";

const createMockEditor = () => ({
  dispatchCommand: vi.fn(),
  getEditorState: vi.fn().mockReturnValue({
    read: vi.fn((fn) => fn()),
  }),
});

let mockEditor: any;

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: vi.fn(() => {
    mockEditor = createMockEditor();
    return [mockEditor];
  }),
}));

vi.mock("lexical", () => ({
  $getSelection: vi.fn(() => ({
    anchor: {
      getNode: vi.fn(() => ({
        getParent: vi.fn(() => null),
        getTextContentSize: vi.fn(() => 10),
      })),
      offset: 0,
    },
    focus: {
      getNode: vi.fn(() => ({
        getParent: vi.fn(() => null),
        getTextContentSize: vi.fn(() => 10),
      })),
      offset: 0,
    },
    isBackward: vi.fn(() => false),
  })),
  $isRangeSelection: vi.fn(() => true),
}));

vi.mock("@lexical/link", () => ({
  $isLinkNode: vi.fn(() => false),
  TOGGLE_LINK_COMMAND: "toggleLink",
}));

vi.mock("@/lib/utils/url", () => ({
  isStringUrl: vi.fn((url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }),
}));

describe("LinkEditor", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockSetOpen = vi.fn();

  test("renders link editor when open", () => {
    render(<LinkEditor editor={mockEditor as any} open={true} setOpen={mockSetOpen} />);

    expect(screen.getByPlaceholderText("https://example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.save" })).toBeInTheDocument();
  });

  test("does not render when closed", () => {
    render(<LinkEditor editor={mockEditor as any} open={false} setOpen={mockSetOpen} />);

    expect(screen.queryByPlaceholderText("https://example.com")).not.toBeInTheDocument();
  });

  test("initializes with https:// when no link is selected", () => {
    render(<LinkEditor editor={mockEditor as any} open={true} setOpen={mockSetOpen} />);

    const input = screen.getByPlaceholderText("https://example.com") as HTMLInputElement;
    expect(input.value).toBe("https://");
  });

  test("submits valid URL on form submit", async () => {
    const user = userEvent.setup();
    render(<LinkEditor editor={mockEditor as any} open={true} setOpen={mockSetOpen} />);

    const input = screen.getByPlaceholderText("https://example.com");
    await user.clear(input);
    await user.type(input, "https://formbricks.com");

    const submitButton = screen.getByRole("button", { name: "common.save" });
    await user.click(submitButton);

    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith("toggleLink", {
      url: "https://formbricks.com",
      target: "_blank",
      rel: "noopener noreferrer",
    });
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  test("submits on Enter key when URL is valid", async () => {
    const user = userEvent.setup();
    render(<LinkEditor editor={mockEditor as any} open={true} setOpen={mockSetOpen} />);

    const input = screen.getByPlaceholderText("https://example.com");
    await user.clear(input);
    await user.type(input, "https://formbricks.com{Enter}");

    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith("toggleLink", {
      url: "https://formbricks.com",
      target: "_blank",
      rel: "noopener noreferrer",
    });
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  test("closes on Escape key", async () => {
    const user = userEvent.setup();
    render(<LinkEditor editor={mockEditor as any} open={true} setOpen={mockSetOpen} />);

    const input = screen.getByPlaceholderText("https://example.com");
    await user.type(input, "{Escape}");

    expect(mockSetOpen).toHaveBeenCalledWith(false);
    expect(mockEditor.dispatchCommand).not.toHaveBeenCalled();
  });

  test("validates URL and shows error for invalid URL", async () => {
    const user = userEvent.setup();
    render(<LinkEditor editor={mockEditor as any} open={true} setOpen={mockSetOpen} />);

    const input = screen.getByPlaceholderText("https://example.com") as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "https://abc");

    // Trigger validation by trying to submit
    const submitButton = screen.getByRole("button", { name: "common.save" });
    await user.click(submitButton);

    const errorMessage = screen.getAllByText("environments.surveys.edit.please_enter_a_valid_url");

    // Check that the custom validation message is set
    expect(errorMessage).toBeVisible;
  });

  test("clears validation message when valid URL is entered", async () => {
    const user = userEvent.setup();
    render(<LinkEditor editor={mockEditor as any} open={true} setOpen={mockSetOpen} />);

    const input = screen.getByPlaceholderText("https://example.com") as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "https://abc");

    // Now enter valid URL
    await user.clear(input);
    await user.type(input, "https://formbricks.com");

    expect(input.validationMessage).toBe("");
  });

  test("updates link URL on input change", async () => {
    const user = userEvent.setup();
    render(<LinkEditor editor={mockEditor as any} open={true} setOpen={mockSetOpen} />);

    const input = screen.getByPlaceholderText("https://example.com") as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "https://example.org");

    expect(input.value).toBe("https://example.org");
  });

  test("requires input to have value before submission", () => {
    render(<LinkEditor editor={mockEditor as any} open={true} setOpen={mockSetOpen} />);

    const input = screen.getByPlaceholderText("https://example.com") as HTMLInputElement;
    expect(input).toBeRequired();
    expect(input.type).toBe("url");
  });
});
