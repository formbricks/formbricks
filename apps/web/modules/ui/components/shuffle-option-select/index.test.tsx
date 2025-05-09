import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TShuffleOption } from "@formbricks/types/surveys/types";
import { ShuffleOptionSelect } from "./index";

// Mock Select component
vi.mock("@/modules/ui/components/select", () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <div data-testid="select" data-value={value}>
      <button data-testid="select-trigger" onClick={() => document.dispatchEvent(new Event("open-select"))}>
        Open Select
      </button>
      <div data-testid="select-content">{children}</div>
    </div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content-inner">{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div
      data-testid="select-item"
      data-value={value}
      onClick={() => document.dispatchEvent(new CustomEvent("select-item", { detail: value }))}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger-inner">{children}</div>,
  SelectValue: ({ placeholder }: any) => <div data-testid="select-value">{placeholder}</div>,
}));

// Mock tolgee
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => (key === "environments.surveys.edit.select_ordering" ? "Select ordering" : key),
  }),
}));

describe("ShuffleOptionSelect", () => {
  afterEach(() => {
    cleanup();
  });

  const shuffleOptionsTypes = {
    none: { id: "none", label: "Don't shuffle", show: true },
    all: { id: "all", label: "Shuffle all options", show: true },
    exceptLast: { id: "exceptLast", label: "Shuffle all except last option", show: true },
  };

  const mockUpdateQuestion = vi.fn();

  test("renders with default value", () => {
    render(
      <ShuffleOptionSelect
        shuffleOption="none"
        updateQuestion={mockUpdateQuestion}
        questionIdx={0}
        shuffleOptionsTypes={shuffleOptionsTypes}
      />
    );

    expect(screen.getByTestId("select")).toBeInTheDocument();
    expect(screen.getByTestId("select")).toHaveAttribute("data-value", "none");
    expect(screen.getByTestId("select-value")).toHaveTextContent("Select ordering");
  });

  test("renders all shuffle options", () => {
    render(
      <ShuffleOptionSelect
        shuffleOption="none"
        updateQuestion={mockUpdateQuestion}
        questionIdx={0}
        shuffleOptionsTypes={shuffleOptionsTypes}
      />
    );

    const selectItems = screen.getAllByTestId("select-item");
    expect(selectItems).toHaveLength(3);
    expect(selectItems[0]).toHaveTextContent("Don't shuffle");
    expect(selectItems[1]).toHaveTextContent("Shuffle all options");
    expect(selectItems[2]).toHaveTextContent("Shuffle all except last option");
  });

  test("only renders visible shuffle options", () => {
    const limitedOptions = {
      none: { id: "none", label: "Don't shuffle", show: true },
      all: { id: "all", label: "Shuffle all options", show: false }, // This one shouldn't show
      exceptLast: { id: "exceptLast", label: "Shuffle all except last option", show: true },
    };

    render(
      <ShuffleOptionSelect
        shuffleOption="none"
        updateQuestion={mockUpdateQuestion}
        questionIdx={0}
        shuffleOptionsTypes={limitedOptions}
      />
    );

    const selectItems = screen.getAllByTestId("select-item");
    expect(selectItems).toHaveLength(2);
    expect(selectItems[0]).toHaveTextContent("Don't shuffle");
    expect(selectItems[1]).toHaveTextContent("Shuffle all except last option");
  });
});
