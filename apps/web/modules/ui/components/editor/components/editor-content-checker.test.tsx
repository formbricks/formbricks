// Import the module being mocked
import * as LexicalComposerContext from "@lexical/react/LexicalComposerContext";
import { cleanup, render } from "@testing-library/react";
import * as lexical from "lexical";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EditorContentChecker } from "./editor-content-checker";

// Mock Lexical context
vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: vi.fn(() => {
    return [
      {
        update: vi.fn((callback) => callback()),
        registerUpdateListener: vi.fn(() => vi.fn()),
      },
    ];
  }),
}));

// Mock lexical functions
vi.mock("lexical", () => ({
  $getRoot: vi.fn(() => ({
    getChildren: vi.fn(() => []),
    getTextContent: vi.fn(() => ""),
  })),
}));

describe("EditorContentChecker", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("calls onEmptyChange with true for empty editor", () => {
    const onEmptyChange = vi.fn();

    // Reset the mocks to avoid previous calls
    vi.mocked(LexicalComposerContext.useLexicalComposerContext).mockClear();

    render(<EditorContentChecker onEmptyChange={onEmptyChange} />);

    // Should be called once on initial render
    expect(onEmptyChange).toHaveBeenCalledWith(true);
  });

  test("unregisters update listener on unmount", () => {
    const onEmptyChange = vi.fn();
    const unregisterMock = vi.fn();

    // Configure mock to return our specific unregister function
    vi.mocked(LexicalComposerContext.useLexicalComposerContext).mockReturnValueOnce([
      {
        update: vi.fn((callback) => callback()),
        registerUpdateListener: vi.fn(() => unregisterMock),
      },
    ]);

    const { unmount } = render(<EditorContentChecker onEmptyChange={onEmptyChange} />);
    unmount();

    expect(unregisterMock).toHaveBeenCalled();
  });

  test("checks for non-empty content", () => {
    const onEmptyChange = vi.fn();

    // Mock non-empty content
    vi.mocked(lexical.$getRoot).mockReturnValueOnce({
      getChildren: vi.fn(() => ["child1", "child2"]),
      getTextContent: vi.fn(() => "Some content"),
    });

    render(<EditorContentChecker onEmptyChange={onEmptyChange} />);

    expect(onEmptyChange).toHaveBeenCalledWith(false);
  });

  test("checks for whitespace-only content", () => {
    const onEmptyChange = vi.fn();

    // Mock whitespace-only content
    vi.mocked(lexical.$getRoot).mockReturnValueOnce({
      getChildren: vi.fn(() => ["child"]),
      getTextContent: vi.fn(() => "   "),
    });

    render(<EditorContentChecker onEmptyChange={onEmptyChange} />);

    expect(onEmptyChange).toHaveBeenCalledWith(true);
  });
});
