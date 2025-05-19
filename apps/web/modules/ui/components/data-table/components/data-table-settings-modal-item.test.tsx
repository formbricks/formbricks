import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DataTableSettingsModalItem } from "./data-table-settings-modal-item";

// Mock the dnd-kit hooks
vi.mock("@dnd-kit/sortable", async () => {
  const actual = await vi.importActual("@dnd-kit/sortable");
  return {
    ...actual,
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1 },
      transition: "transform 100ms ease",
      isDragging: false,
    }),
  };
});

describe("DataTableSettingsModalItem", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders standard column name correctly", () => {
    const mockColumn = {
      id: "firstName",
      getIsVisible: vi.fn().mockReturnValue(true),
      toggleVisibility: vi.fn(),
    };

    render(<DataTableSettingsModalItem column={mockColumn as any} />);

    expect(screen.getByText("environments.contacts.first_name")).toBeInTheDocument();
    const switchElement = screen.getByRole("switch");
    expect(switchElement).toBeInTheDocument();
    expect(switchElement).toHaveAttribute("aria-checked", "true");
  });

  test("renders createdAt column with correct label", () => {
    const mockColumn = {
      id: "createdAt",
      getIsVisible: vi.fn().mockReturnValue(true),
      toggleVisibility: vi.fn(),
    };

    render(<DataTableSettingsModalItem column={mockColumn as any} />);

    expect(screen.getByText("common.date")).toBeInTheDocument();
  });

  test("renders verifiedEmail column with correct label", () => {
    const mockColumn = {
      id: "verifiedEmail",
      getIsVisible: vi.fn().mockReturnValue(true),
      toggleVisibility: vi.fn(),
    };

    render(<DataTableSettingsModalItem column={mockColumn as any} />);

    expect(screen.getByText("common.verified_email")).toBeInTheDocument();
  });

  test("renders userId column with correct label", () => {
    const mockColumn = {
      id: "userId",
      getIsVisible: vi.fn().mockReturnValue(true),
      toggleVisibility: vi.fn(),
    };

    render(<DataTableSettingsModalItem column={mockColumn as any} />);

    expect(screen.getByText("common.user_id")).toBeInTheDocument();
  });

  test("renders question from survey with localized headline", () => {
    const mockColumn = {
      id: "question1",
      getIsVisible: vi.fn().mockReturnValue(true),
      toggleVisibility: vi.fn(),
    };

    const mockSurvey = {
      questions: [
        {
          id: "question1",
          type: "open",
          headline: { default: "Test Question" },
        },
      ],
    };

    render(<DataTableSettingsModalItem column={mockColumn as any} survey={mockSurvey as any} />);

    expect(screen.getByText("Test Question")).toBeInTheDocument();
  });

  test("toggles visibility when switch is clicked", async () => {
    const toggleVisibilityMock = vi.fn();
    const mockColumn = {
      id: "lastName",
      getIsVisible: vi.fn().mockReturnValue(true),
      toggleVisibility: toggleVisibilityMock,
    };

    render(<DataTableSettingsModalItem column={mockColumn as any} />);

    const switchElement = screen.getByRole("switch");
    await userEvent.click(switchElement);

    expect(toggleVisibilityMock).toHaveBeenCalledWith(false);
  });
});
