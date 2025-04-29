import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EditPublicSurveyAlertDialog } from "./index";

// Mock translation to return keys as text
vi.mock("@tolgee/react", () => ({ useTranslate: () => ({ t: (key: string) => key }) }));

describe("EditPublicSurveyAlertDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders with all expected content", () => {
    const setOpen = vi.fn();
    render(<EditPublicSurveyAlertDialog open={true} setOpen={setOpen} />);

    // Title
    expect(screen.getByText("environments.surveys.edit.caution_edit_published_survey")).toBeInTheDocument();

    // Paragraphs
    expect(screen.getByText("environments.surveys.edit.caution_recommendation")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.caution_explanation_intro")).toBeInTheDocument();

    // List items
    expect(
      screen.getByText("environments.surveys.edit.caution_explanation_responses_are_safe")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.caution_explanation_new_responses_separated")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.caution_explanation_only_new_responses_in_summary")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.edit.caution_explanation_all_data_as_download")
    ).toBeInTheDocument();
  });

  test("renders default close button and calls setOpen when clicked", () => {
    const setOpen = vi.fn();
    render(<EditPublicSurveyAlertDialog open={true} setOpen={setOpen} />);

    // Find the close button in the UI
    const closeButton = screen.getByRole("button", { name: "common.close" });
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  test("renders primary button and calls action when clicked", async () => {
    const setOpen = vi.fn();
    const primaryAction = vi.fn().mockResolvedValue(undefined);

    render(
      <EditPublicSurveyAlertDialog
        open={true}
        setOpen={setOpen}
        primaryButtonAction={primaryAction}
        primaryButtonText="Primary Text"
      />
    );

    const primaryButton = screen.getByRole("button", { name: "Primary Text" });
    expect(primaryButton).toBeInTheDocument();

    fireEvent.click(primaryButton);

    await waitFor(() => {
      expect(primaryAction).toHaveBeenCalledTimes(1);
    });
  });

  test("renders secondary button and calls action when clicked", () => {
    const setOpen = vi.fn();
    const secondaryAction = vi.fn();

    render(
      <EditPublicSurveyAlertDialog
        open={true}
        setOpen={setOpen}
        secondaryButtonAction={secondaryAction}
        secondaryButtonText="Secondary Text"
      />
    );

    const secondaryButton = screen.getByRole("button", { name: "Secondary Text" });
    expect(secondaryButton).toBeInTheDocument();

    fireEvent.click(secondaryButton);
    expect(secondaryAction).toHaveBeenCalledTimes(1);
    expect(setOpen).not.toHaveBeenCalled();
  });

  test("renders both buttons when both actions are provided", async () => {
    const setOpen = vi.fn();
    const primaryAction = vi.fn().mockResolvedValue(undefined);
    const secondaryAction = vi.fn();

    render(
      <EditPublicSurveyAlertDialog
        open={true}
        setOpen={setOpen}
        primaryButtonAction={primaryAction}
        primaryButtonText="Primary Text"
        secondaryButtonAction={secondaryAction}
        secondaryButtonText="Secondary Text"
      />
    );

    // Modal has a close button by default plus our two action buttons
    const allButtons = screen.getAllByRole("button");
    // Verify our two action buttons by their text content
    const actionButtons = allButtons.filter(
      (button) => button.textContent === "Secondary Text" || button.textContent === "Primary Text"
    );
    expect(actionButtons).toHaveLength(2);
    expect(actionButtons[0]).toHaveTextContent("Secondary Text");
    expect(actionButtons[1]).toHaveTextContent("Primary Text");

    fireEvent.click(actionButtons[0]);
    expect(secondaryAction).toHaveBeenCalledTimes(1);

    fireEvent.click(actionButtons[1]);
    await waitFor(() => {
      expect(primaryAction).toHaveBeenCalledTimes(1);
    });
  });

  test("shows loading state in primary button when isLoading is true", () => {
    const setOpen = vi.fn();
    const primaryAction = vi.fn().mockResolvedValue(undefined);

    render(
      <EditPublicSurveyAlertDialog
        open={true}
        setOpen={setOpen}
        isLoading={true}
        primaryButtonAction={primaryAction}
        primaryButtonText="Primary Text"
      />
    );

    const primaryButton = screen.getByRole("button", { name: "Primary Text" });
    // Check if button has loading class or attribute
    expect(
      primaryButton.classList.contains("loading") ||
        primaryButton.innerHTML.includes("loader") ||
        primaryButton.getAttribute("aria-busy") === "true"
    ).toBeTruthy();
  });
});
