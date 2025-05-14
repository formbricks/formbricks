import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./index";

// Mock radix-ui portal to make testing easier
vi.mock("@radix-ui/react-select", async () => {
  const actual = await vi.importActual("@radix-ui/react-select");
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="select-portal">{children}</div>
    ),
  };
});

describe("Select", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the select trigger correctly", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
      </Select>
    );

    const trigger = screen.getByText("Select an option");
    expect(trigger).toBeInTheDocument();
    expect(trigger.closest("button")).toHaveClass("border-slate-300");
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  test("renders select trigger without arrow when hideArrow is true", () => {
    render(
      <Select>
        <SelectTrigger hideArrow>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
      </Select>
    );

    const chevronIcon = document.querySelector(".opacity-50");
    expect(chevronIcon).not.toBeInTheDocument();
  });

  test("renders select trigger with arrow by default", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
      </Select>
    );

    const chevronIcon = document.querySelector(".opacity-50");
    expect(chevronIcon).toBeInTheDocument();
  });

  test("applies custom className to select trigger", () => {
    render(
      <Select>
        <SelectTrigger className="custom-class">
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
      </Select>
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveClass("custom-class");
  });
});
