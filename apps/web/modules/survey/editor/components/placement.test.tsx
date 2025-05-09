import { Placement } from "@/modules/survey/editor/components/placement";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TPlacement } from "@formbricks/types/common";

// Mock useTranslate
const mockSetCurrentPlacement = vi.fn();
const mockSetOverlay = vi.fn();
const mockSetClickOutsideClose = vi.fn();

const defaultProps = {
  currentPlacement: "bottomRight" as TPlacement,
  setCurrentPlacement: mockSetCurrentPlacement,
  setOverlay: mockSetOverlay,
  overlay: "light",
  setClickOutsideClose: mockSetClickOutsideClose,
  clickOutsideClose: false,
};

describe("Placement Component", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders placement options correctly", () => {
    render(<Placement {...defaultProps} />);
    expect(screen.getByLabelText("common.bottom_right")).toBeInTheDocument();
    expect(screen.getByLabelText("common.top_right")).toBeInTheDocument();
    expect(screen.getByLabelText("common.top_left")).toBeInTheDocument();
    expect(screen.getByLabelText("common.bottom_left")).toBeInTheDocument();
    expect(screen.getByLabelText("common.centered_modal")).toBeInTheDocument();
    expect(screen.getByLabelText("common.bottom_right")).toBeChecked();
  });

  test("calls setCurrentPlacement when a placement option is clicked", async () => {
    const user = userEvent.setup();
    render(<Placement {...defaultProps} />);
    const topLeftRadio = screen.getByLabelText("common.top_left");
    await user.click(topLeftRadio);
    expect(mockSetCurrentPlacement).toHaveBeenCalledWith("topLeft");
  });

  test("does not render overlay and click-outside options initially", () => {
    render(<Placement {...defaultProps} />);
    expect(
      screen.queryByLabelText("environments.surveys.edit.centered_modal_overlay_color")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("common.allow_users_to_exit_by_clicking_outside_the_survey")
    ).not.toBeInTheDocument();
  });

  test("renders overlay and click-outside options when placement is 'center'", () => {
    render(<Placement {...defaultProps} currentPlacement="center" />);
    // Use getByText for the heading labels
    expect(screen.getByText("environments.surveys.edit.centered_modal_overlay_color")).toBeInTheDocument();
    expect(screen.getByText("common.allow_users_to_exit_by_clicking_outside_the_survey")).toBeInTheDocument();

    // Keep getByLabelText for the actual radio button labels
    expect(screen.getByLabelText("common.light_overlay")).toBeInTheDocument();
    expect(screen.getByLabelText("common.dark_overlay")).toBeInTheDocument();
    expect(screen.getByLabelText("common.allow")).toBeInTheDocument();
    expect(screen.getByLabelText("common.disallow")).toBeInTheDocument();
  });

  test("calls setOverlay when overlay option is clicked", async () => {
    const user = userEvent.setup();
    render(<Placement {...defaultProps} currentPlacement="center" overlay="light" />);
    const darkOverlayRadio = screen.getByLabelText("common.dark_overlay");
    await user.click(darkOverlayRadio);
    expect(mockSetOverlay).toHaveBeenCalledWith("dark");
  });

  // Test clicking 'allow' when starting with clickOutsideClose = false
  test("calls setClickOutsideClose(true) when 'allow' is clicked", async () => {
    const user = userEvent.setup();
    render(<Placement {...defaultProps} currentPlacement="center" clickOutsideClose={false} />);
    const allowRadio = screen.getByLabelText("common.allow");
    await user.click(allowRadio);
    expect(mockSetClickOutsideClose).toHaveBeenCalledTimes(1);
    expect(mockSetClickOutsideClose).toHaveBeenCalledWith(true);
  });

  // Test clicking 'disallow' when starting with clickOutsideClose = true
  test("calls setClickOutsideClose(false) when 'disallow' is clicked", async () => {
    const user = userEvent.setup();
    render(<Placement {...defaultProps} currentPlacement="center" clickOutsideClose={true} />);
    const disallowRadio = screen.getByLabelText("common.disallow");
    await user.click(disallowRadio);
    expect(mockSetClickOutsideClose).toHaveBeenCalledTimes(1);
    expect(mockSetClickOutsideClose).toHaveBeenCalledWith(false);
  });

  test("applies correct overlay style based on placement and overlay props", () => {
    const { rerender } = render(<Placement {...defaultProps} />);
    let previewDiv = screen.getByTestId("placement-preview");
    expect(previewDiv).toHaveClass("bg-slate-200");

    rerender(<Placement {...defaultProps} currentPlacement="center" overlay="light" />);
    previewDiv = screen.getByTestId("placement-preview");
    expect(previewDiv).toHaveClass("bg-slate-200");

    rerender(<Placement {...defaultProps} currentPlacement="center" overlay="dark" />);
    previewDiv = screen.getByTestId("placement-preview");
    expect(previewDiv).toHaveClass("bg-slate-700/80");
  });

  test("applies cursor-not-allowed when clickOutsideClose is false", () => {
    render(<Placement {...defaultProps} clickOutsideClose={false} />);
    const previewDiv = screen.getByTestId("placement-preview");
    expect(previewDiv).toHaveClass("cursor-not-allowed");
  });

  test("does not apply cursor-not-allowed when clickOutsideClose is true", () => {
    render(<Placement {...defaultProps} clickOutsideClose={true} />);
    const previewDiv = screen.getByTestId("placement-preview");
    expect(previewDiv).not.toHaveClass("cursor-not-allowed");
  });
});
