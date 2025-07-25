import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ToolbarPlugin } from "./toolbar-plugin";

// Create a mock editor that includes all the required methods
const createMockEditor = () => ({
  update: vi.fn((fn) => fn()),
  registerUpdateListener: vi.fn(() => () => {}),
  registerCommand: vi.fn(() => () => {}),
  dispatchCommand: vi.fn(),
  getEditorState: vi.fn().mockReturnValue({
    read: vi.fn((fn) => fn()),
  }),
  getRootElement: vi.fn(() => document.createElement("div")),
  getElementByKey: vi.fn(() => document.createElement("div")),
  blur: vi.fn(),
});

// Store a reference to the mock editor
let mockEditor;

// Mock Lexical hooks and functions
vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: vi.fn(() => {
    mockEditor = createMockEditor();
    return [mockEditor];
  }),
}));

// Mock lexical functions for selection handling
vi.mock("lexical", () => ({
  $getSelection: vi.fn(() => ({
    anchor: {
      getNode: vi.fn(() => ({
        getKey: vi.fn(),
        getTopLevelElementOrThrow: vi.fn(() => ({
          getKey: vi.fn(),
          getTag: vi.fn(),
          getType: vi.fn().mockReturnValue("paragraph"),
        })),
        getParent: vi.fn(() => null),
      })),
    },
    focus: {
      getNode: vi.fn(() => ({
        getKey: vi.fn(),
      })),
    },
    isCollapsed: vi.fn(),
    hasFormat: vi.fn(),
    insertRawText: vi.fn(),
  })),
  $isRangeSelection: vi.fn().mockReturnValue(true),
  $wrapNodes: vi.fn(),
  $createParagraphNode: vi.fn().mockReturnValue({
    select: vi.fn(),
  }),
  $getRoot: vi.fn().mockReturnValue({
    clear: vi.fn().mockReturnValue({
      append: vi.fn(),
    }),
    select: vi.fn(),
  }),
  FORMAT_TEXT_COMMAND: "formatText",
  SELECTION_CHANGE_COMMAND: "selectionChange",
  COMMAND_PRIORITY_CRITICAL: 1,
  PASTE_COMMAND: "paste",
  $insertNodes: vi.fn(),
}));

// Mock Lexical list related functions
vi.mock("@lexical/list", () => ({
  $isListNode: vi.fn(),
  INSERT_ORDERED_LIST_COMMAND: "insertOrderedList",
  INSERT_UNORDERED_LIST_COMMAND: "insertUnorderedList",
  REMOVE_LIST_COMMAND: "removeList",
  ListNode: class {},
}));

// Mock Lexical rich text functions
vi.mock("@lexical/rich-text", () => ({
  $createHeadingNode: vi.fn(),
  $isHeadingNode: vi.fn(),
}));

// Mock Lexical selection functions
vi.mock("@lexical/selection", () => ({
  $isAtNodeEnd: vi.fn(),
  $wrapNodes: vi.fn(),
}));

// Mock Lexical utils - properly mock mergeRegister to return a cleanup function
vi.mock("@lexical/utils", () => ({
  $getNearestNodeOfType: vi.fn(),
  mergeRegister: vi.fn((...args) => {
    // Return a function that can be called during cleanup
    return () => {
      args.forEach((fn) => {
        if (typeof fn === "function") fn();
      });
    };
  }),
}));

// Mock Lexical link functions
vi.mock("@lexical/link", () => ({
  $isLinkNode: vi.fn(),
  TOGGLE_LINK_COMMAND: "toggleLink",
}));

// Mock HTML generation
vi.mock("@lexical/html", () => ({
  $generateHtmlFromNodes: vi.fn().mockReturnValue("<p>Generated HTML</p>"),
  $generateNodesFromDOM: vi.fn().mockReturnValue([]),
}));

// Mock UI components used by ToolbarPlugin
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, className }: any) => (
    <button onClick={onClick} className={className} data-testid="button">
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-menu-content">{children}</div>,
  DropdownMenuItem: ({ children }: any) => <div data-testid="dropdown-menu-item">{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-menu-trigger">{children}</div>,
}));

vi.mock("@/modules/ui/components/input", () => ({
  Input: ({ value, onChange, onKeyDown, className }: any) => (
    <input
      data-testid="input"
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      className={className}
    />
  ),
}));

vi.mock("lucide-react", () => ({
  Bold: () => <span data-testid="bold-icon">Bold</span>,
  Italic: () => <span data-testid="italic-icon">Italic</span>,
  Link: () => <span data-testid="link-icon">Link</span>,
  Underline: () => <span data-testid="underline-icon">Underline</span>,
  ChevronDownIcon: () => <span data-testid="chevron-icon">ChevronDown</span>,
}));

vi.mock("react-dom", () => ({
  createPortal: (children: React.ReactNode) => <div data-testid="portal">{children}</div>,
}));

// Mock AddVariablesDropdown
vi.mock("./add-variables-dropdown", () => ({
  AddVariablesDropdown: ({ addVariable, variables }: any) => (
    <div data-testid="add-variables-dropdown">
      <button data-testid="add-variable-button" onClick={() => addVariable("test_variable")}>
        Add Variable
      </button>
      <span>Variables: {variables?.join(", ")}</span>
    </div>
  ),
}));

describe("ToolbarPlugin", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders toolbar with default items", () => {
    render(
      <ToolbarPlugin
        getText={() => "Sample text"}
        setText={vi.fn()}
        editable={true}
        container={document.createElement("div")}
      />
    );

    // Check if toolbar components are rendered
    expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
    expect(screen.getByTestId("bold-icon")).toBeInTheDocument();
    expect(screen.getByTestId("italic-icon")).toBeInTheDocument();
    expect(screen.getByTestId("underline-icon")).toBeInTheDocument();
    expect(screen.getByTestId("link-icon")).toBeInTheDocument();
  });

  test("does not render when editable is false", () => {
    const { container } = render(
      <ToolbarPlugin
        getText={() => "Sample text"}
        setText={vi.fn()}
        editable={false}
        container={document.createElement("div")}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  test("renders variables dropdown when variables are provided", async () => {
    render(
      <ToolbarPlugin
        getText={() => "Sample text"}
        setText={vi.fn()}
        editable={true}
        variables={["name", "email"]}
        container={document.createElement("div")}
      />
    );

    expect(screen.getByTestId("add-variables-dropdown")).toBeInTheDocument();
    expect(screen.getByText("Variables: name, email")).toBeInTheDocument();
  });

  test("excludes toolbar items when specified", () => {
    const { rerender } = render(
      <ToolbarPlugin
        getText={() => "Sample text"}
        setText={vi.fn()}
        editable={true}
        container={document.createElement("div")}
        excludedToolbarItems={["bold", "italic", "underline"]}
      />
    );

    // Should not render bold and italic buttons but should render link
    expect(screen.queryByTestId("bold-icon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("italic-icon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("underline-icon")).not.toBeInTheDocument();
    expect(screen.getByTestId("link-icon")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();

    // Rerender with different excluded items
    rerender(
      <ToolbarPlugin
        getText={() => "Sample text"}
        setText={vi.fn()}
        editable={true}
        container={document.createElement("div")}
        excludedToolbarItems={["blockType", "link"]}
      />
    );

    expect(screen.queryByTestId("dropdown-menu")).not.toBeInTheDocument();
    expect(screen.queryByTestId("link-icon")).not.toBeInTheDocument();
    expect(screen.getByTestId("bold-icon")).toBeInTheDocument();
    expect(screen.getByTestId("italic-icon")).toBeInTheDocument();
    expect(screen.getByTestId("underline-icon")).toBeInTheDocument();
  });

  test("excludes all toolbar items when specified", () => {
    render(
      <ToolbarPlugin
        getText={() => "Sample text"}
        setText={vi.fn()}
        editable={true}
        container={document.createElement("div")}
        excludedToolbarItems={["blockType", "bold", "italic", "underline", "link"]}
      />
    );

    expect(screen.queryByTestId("dropdown-menu")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bold-icon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("italic-icon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("underline-icon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("link-icon")).not.toBeInTheDocument();
  });

  test("handles firstRender and updateTemplate props", () => {
    const setText = vi.fn();

    render(
      <ToolbarPlugin
        getText={() => "<p>Initial text</p>"}
        setText={setText}
        editable={true}
        container={document.createElement("div")}
        firstRender={false}
        setFirstRender={vi.fn()}
        updateTemplate={true}
      />
    );

    // Since we've mocked most Lexical functions, we're primarily checking that
    // the component renders without errors when these props are provided
    expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
  });

  describe("User Interactions", () => {
    test("dispatches bold format command on click", async () => {
      render(
        <ToolbarPlugin
          getText={() => "Sample text"}
          setText={vi.fn()}
          editable={true}
          container={document.createElement("div")}
        />
      );

      const boldIcon = screen.getByTestId("bold-icon");
      const boldButton = boldIcon.parentElement;
      expect(boldButton).toBeInTheDocument();
      expect(boldButton).not.toBeNull();
      await userEvent.click(boldButton!);

      expect(mockEditor.dispatchCommand).toHaveBeenCalledWith("formatText", "bold");
    });

    test("dispatches italic format command on click", async () => {
      render(
        <ToolbarPlugin
          getText={() => "Sample text"}
          setText={vi.fn()}
          editable={true}
          container={document.createElement("div")}
        />
      );

      const italicIcon = screen.getByTestId("italic-icon");
      const italicButton = italicIcon.parentElement;
      expect(italicButton).toBeInTheDocument();
      expect(italicButton).not.toBeNull();
      await userEvent.click(italicButton!);

      expect(mockEditor.dispatchCommand).toHaveBeenCalledWith("formatText", "italic");
    });

    test("dispatches underline format command on click", async () => {
      render(
        <ToolbarPlugin
          getText={() => "Sample text"}
          setText={vi.fn()}
          editable={true}
          container={document.createElement("div")}
        />
      );

      const underlineIcon = screen.getByTestId("underline-icon");
      const underlineButton = underlineIcon.parentElement;
      expect(underlineButton).toBeInTheDocument();
      expect(underlineButton).not.toBeNull();
      await userEvent.click(underlineButton!);

      expect(mockEditor.dispatchCommand).toHaveBeenCalledWith("formatText", "underline");
    });

    test("dispatches link command on click", async () => {
      render(
        <ToolbarPlugin
          getText={() => "Sample text"}
          setText={vi.fn()}
          editable={true}
          container={document.createElement("div")}
        />
      );

      const linkIcon = screen.getByTestId("link-icon");
      const linkButton = linkIcon.parentElement;
      expect(linkButton).toBeInTheDocument();
      expect(linkButton).not.toBeNull();
      await userEvent.click(linkButton!);

      expect(mockEditor.dispatchCommand).toHaveBeenCalledWith("toggleLink", {
        url: "https://",
      });
    });

    test("dispatches numbered list command on click", async () => {
      render(
        <ToolbarPlugin
          getText={() => "Sample text"}
          setText={vi.fn()}
          editable={true}
          container={document.createElement("div")}
        />
      );

      const dropdownTrigger = screen.getByTestId("dropdown-menu-trigger");
      await userEvent.click(dropdownTrigger);

      const numberedListButton = screen.getAllByTestId("button")[1]; // ol
      await userEvent.click(numberedListButton);

      expect(mockEditor.dispatchCommand).toHaveBeenCalledWith("insertOrderedList", undefined);
    });

    test("dispatches bulleted list command on click", async () => {
      render(
        <ToolbarPlugin
          getText={() => "Sample text"}
          setText={vi.fn()}
          editable={true}
          container={document.createElement("div")}
        />
      );

      const dropdownTrigger = screen.getByTestId("dropdown-menu-trigger");
      await userEvent.click(dropdownTrigger);

      const bulletedListButton = screen.getAllByTestId("button")[2]; // ul
      await userEvent.click(bulletedListButton);

      expect(mockEditor.dispatchCommand).toHaveBeenCalledWith("insertUnorderedList", undefined);
    });
  });
});
