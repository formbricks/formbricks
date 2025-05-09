import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSegmentWithSurveyNames } from "@formbricks/types/segment";
import { ConfirmDeleteSegmentModal } from "./index";

describe("ConfirmDeleteSegmentModal", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders modal with segment that has no surveys", async () => {
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

    expect(screen.getByText("common.are_you_sure_this_action_cannot_be_undone")).toBeInTheDocument();

    const deleteButton = screen.getByText("common.delete");
    expect(deleteButton).not.toBeDisabled();

    await userEvent.click(deleteButton);
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  test("renders modal with segment that has surveys and disables delete button", async () => {
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

    expect(
      screen.getByText("environments.segments.cannot_delete_segment_used_in_surveys")
    ).toBeInTheDocument();
    expect(screen.getByText("Active Survey 1")).toBeInTheDocument();
    expect(screen.getByText("Inactive Survey 1")).toBeInTheDocument();
    expect(screen.getByText("Inactive Survey 2")).toBeInTheDocument();
    expect(
      screen.getByText(
        "environments.segments.please_remove_the_segment_from_these_surveys_in_order_to_delete_it"
      )
    ).toBeInTheDocument();

    const deleteButton = screen.getByText("common.delete");
    expect(deleteButton).toBeDisabled();
  });

  test("closes the modal when cancel button is clicked", async () => {
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

    const cancelButton = screen.getByText("common.cancel");
    await userEvent.click(cancelButton);
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });
});
