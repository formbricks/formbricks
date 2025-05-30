import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSegmentWithSurveyNames } from "@formbricks/types/segment";
import { ConfirmDeleteSegmentModal } from "./index";

// Mock the Dialog components
vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="dialog">
        {children}
        <button data-testid="dialog-close" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogBody: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-body" className={className}>
      {children}
    </div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

// Mock Button component
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, variant, onClick, disabled }) => (
    <button data-testid={`button-${variant || "primary"}`} data-disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

// Mock the useTranslate hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      const translations = {
        "environments.segments.delete_segment": "Delete Segment",
        "environments.segments.cannot_delete_segment_used_in_surveys":
          "Cannot delete segment used in surveys",
        "environments.segments.please_remove_the_segment_from_these_surveys_in_order_to_delete_it":
          "Please remove the segment from these surveys in order to delete it",
        "common.are_you_sure_this_action_cannot_be_undone": "Are you sure? This action cannot be undone.",
        "common.cancel": "Cancel",
        "common.delete": "Delete",
      };
      return translations[key] || key;
    },
  }),
}));

describe("ConfirmDeleteSegmentModal", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders dialog with segment that has no surveys", async () => {
    const mockSegment: TSegmentWithSurveyNames = {
      id: "seg-123",
      title: "Test Segment",
      description: "",
      isPrivate: false,
      filters: [],
      surveys: [],
      environmentId: "env-123",
      createdAt: new Date(),
      updatedAt: new Date(),
      activeSurveys: [],
      inactiveSurveys: [],
    };

    const mockOnDelete = vi.fn().mockResolvedValue(undefined);
    const mockSetOpen = vi.fn();

    render(
      <ConfirmDeleteSegmentModal
        open={true}
        setOpen={mockSetOpen}
        segment={mockSegment}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
    expect(screen.getByText("Delete Segment")).toBeInTheDocument();
    expect(screen.getByText("Are you sure? This action cannot be undone.")).toBeInTheDocument();

    const deleteButton = screen.getByTestId("button-destructive");
    expect(deleteButton).not.toHaveAttribute("data-disabled", "true");

    await userEvent.click(deleteButton);
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  test("does not render when closed", () => {
    const mockSegment: TSegmentWithSurveyNames = {
      id: "seg-123",
      title: "Test Segment",
      description: "",
      isPrivate: false,
      filters: [],
      surveys: [],
      environmentId: "env-123",
      createdAt: new Date(),
      updatedAt: new Date(),
      activeSurveys: [],
      inactiveSurveys: [],
    };

    const mockOnDelete = vi.fn().mockResolvedValue(undefined);
    const mockSetOpen = vi.fn();

    render(
      <ConfirmDeleteSegmentModal
        open={false}
        setOpen={mockSetOpen}
        segment={mockSegment}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  test("renders dialog with segment that has surveys and disables delete button", async () => {
    const mockSegment: TSegmentWithSurveyNames = {
      id: "seg-456",
      title: "Test Segment With Surveys",
      description: "",
      isPrivate: false,
      filters: [],
      surveys: ["survey-1", "survey-2", "survey-3"],
      environmentId: "env-123",
      createdAt: new Date(),
      updatedAt: new Date(),
      activeSurveys: ["Active Survey 1"],
      inactiveSurveys: ["Inactive Survey 1", "Inactive Survey 2"],
    };

    const mockOnDelete = vi.fn().mockResolvedValue(undefined);
    const mockSetOpen = vi.fn();

    render(
      <ConfirmDeleteSegmentModal
        open={true}
        setOpen={mockSetOpen}
        segment={mockSegment}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByText("Cannot delete segment used in surveys")).toBeInTheDocument();
    expect(screen.getByText("Active Survey 1")).toBeInTheDocument();
    expect(screen.getByText("Inactive Survey 1")).toBeInTheDocument();
    expect(screen.getByText("Inactive Survey 2")).toBeInTheDocument();
    expect(
      screen.getByText("Please remove the segment from these surveys in order to delete it")
    ).toBeInTheDocument();

    const deleteButton = screen.getByTestId("button-destructive");
    expect(deleteButton).toHaveAttribute("data-disabled", "true");
  });

  test("closes the dialog when cancel button is clicked", async () => {
    const mockSegment: TSegmentWithSurveyNames = {
      id: "seg-789",
      title: "Test Segment",
      description: "",
      isPrivate: false,
      filters: [],
      surveys: [],
      environmentId: "env-123",
      createdAt: new Date(),
      updatedAt: new Date(),
      activeSurveys: [],
      inactiveSurveys: [],
    };

    const mockOnDelete = vi.fn().mockResolvedValue(undefined);
    const mockSetOpen = vi.fn();

    render(
      <ConfirmDeleteSegmentModal
        open={true}
        setOpen={mockSetOpen}
        segment={mockSegment}
        onDelete={mockOnDelete}
      />
    );

    const cancelButton = screen.getByTestId("button-secondary");
    await userEvent.click(cancelButton);
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });
});
