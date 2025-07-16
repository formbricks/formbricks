import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { FallbackInput } from "./fallback-input";

vi.mock("react-hot-toast", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      const translations: { [key: string]: string } = {
        "environments.surveys.edit.add_fallback_placeholder":
          "Add a placeholder to show if the question gets skipped:",
        "environments.surveys.edit.fallback_for": "Fallback for",
        "environments.surveys.edit.fallback_missing": "Fallback missing",
        "environments.surveys.edit.add_fallback": "Add",
      };
      return translations[key] || key;
    },
  }),
}));

describe("FallbackInput", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockFilteredRecallItems: (TSurveyRecallItem | undefined)[] = [
    { id: "item1", label: "Item 1", type: "question" },
    { id: "item2", label: "Item 2", type: "question" },
  ];

  const mockSetFallbacks = vi.fn();
  const mockAddFallback = vi.fn();
  const mockSetOpen = vi.fn();
  const mockInputRef = { current: null } as any;

  const defaultProps = {
    filteredRecallItems: mockFilteredRecallItems,
    fallbacks: {},
    setFallbacks: mockSetFallbacks,
    fallbackInputRef: mockInputRef,
    addFallback: mockAddFallback,
    open: true,
    setOpen: mockSetOpen,
  };

  test("renders fallback input component correctly", () => {
    render(<FallbackInput {...defaultProps} />);

    expect(screen.getByText("Add a placeholder to show if the question gets skipped:")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Fallback for Item 1")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Fallback for Item 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  test("enables Add button when fallbacks are provided for all items", () => {
    render(<FallbackInput {...defaultProps} fallbacks={{ item1: "fallback1", item2: "fallback2" }} />);

    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });

  test("updates fallbacks when input changes", async () => {
    const user = userEvent.setup();

    render(<FallbackInput {...defaultProps} />);

    const input1 = screen.getByPlaceholderText("Fallback for Item 1");
    await user.type(input1, "new fallback");

    expect(mockSetFallbacks).toHaveBeenCalledWith({ item1: "new fallback" });
  });

  test("handles Enter key press correctly when input is valid", async () => {
    const user = userEvent.setup();

    render(<FallbackInput {...defaultProps} fallbacks={{ item1: "fallback1", item2: "fallback2" }} />);

    const input = screen.getByPlaceholderText("Fallback for Item 1");
    await user.type(input, "{Enter}");

    expect(mockAddFallback).toHaveBeenCalled();
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  test("shows error toast and doesn't call addFallback when Enter is pressed with empty fallbacks", async () => {
    const user = userEvent.setup();

    render(<FallbackInput {...defaultProps} fallbacks={{ item1: "" }} />);

    const input = screen.getByPlaceholderText("Fallback for Item 1");
    await user.type(input, "{Enter}");

    expect(toast.error).toHaveBeenCalledWith("Fallback missing");
    expect(mockAddFallback).not.toHaveBeenCalled();
    expect(mockSetOpen).not.toHaveBeenCalled();
  });

  test("calls addFallback when Add button is clicked", async () => {
    const user = userEvent.setup();

    render(<FallbackInput {...defaultProps} fallbacks={{ item1: "fallback1", item2: "fallback2" }} />);

    const addButton = screen.getByRole("button", { name: "Add" });
    await user.click(addButton);

    expect(mockAddFallback).toHaveBeenCalled();
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  test("handles undefined recall items gracefully", () => {
    const mixedRecallItems: (TSurveyRecallItem | undefined)[] = [
      { id: "item1", label: "Item 1", type: "question" },
      undefined,
    ];

    render(<FallbackInput {...defaultProps} filteredRecallItems={mixedRecallItems} />);

    expect(screen.getByPlaceholderText("Fallback for Item 1")).toBeInTheDocument();
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
  });

  test("replaces 'nbsp' with space in fallback value", () => {
    render(<FallbackInput {...defaultProps} fallbacks={{ item1: "fallbacknbsptext" }} />);

    const input = screen.getByPlaceholderText("Fallback for Item 1");
    expect(input).toHaveValue("fallback text");
  });

  test("does not render when open is false", () => {
    render(<FallbackInput {...defaultProps} open={false} />);

    expect(
      screen.queryByText("Add a placeholder to show if the question gets skipped:")
    ).not.toBeInTheDocument();
  });
});
