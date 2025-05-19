import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TAllowedFileExtension } from "@formbricks/types/common";
import { Uploader } from "./uploader";

describe("Uploader", () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    id: "test-id",
    name: "test-file",
    handleDragOver: vi.fn(),
    uploaderClassName: "h-52 w-full",
    handleDrop: vi.fn(),
    allowedFileExtensions: ["jpg", "png", "pdf"] as TAllowedFileExtension[],
    multiple: false,
    handleUpload: vi.fn(),
  };

  test("renders uploader with correct label text", () => {
    render(<Uploader {...defaultProps} />);
    expect(screen.getByText("Click or drag to upload files.")).toBeInTheDocument();
  });

  test("handles file input change correctly", async () => {
    render(<Uploader {...defaultProps} />);

    const fileInput = screen.getByTestId("upload-file-input");

    const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
    await userEvent.upload(fileInput, file);

    expect(defaultProps.handleUpload).toHaveBeenCalledWith([file]);
  });

  test("sets correct accept attribute on file input", () => {
    render(<Uploader {...defaultProps} />);

    const fileInput = screen.getByTestId("upload-file-input");
    expect(fileInput).toHaveAttribute("accept", ".jpg,.png,.pdf");
  });

  test("enables multiple file selection when multiple is true", () => {
    render(<Uploader {...defaultProps} multiple={true} />);

    const fileInput = screen.getByTestId("upload-file-input");
    expect(fileInput).toHaveAttribute("multiple");
  });

  test("applies disabled state correctly", () => {
    render(<Uploader {...defaultProps} disabled={true} />);

    const label = screen.getByTestId("upload-file-label");
    const fileInput = screen.getByTestId("upload-file-input");

    expect(label).toHaveClass("cursor-not-allowed");
    expect(fileInput).toBeDisabled();
  });

  test("applies custom class name", () => {
    const customClass = "custom-class";
    render(<Uploader {...defaultProps} uploaderClassName={customClass} />);

    const label = screen.getByTestId("upload-file-label");
    expect(label).toHaveClass(customClass);
  });

  test("does not call event handlers when disabled", () => {
    render(<Uploader {...defaultProps} disabled={true} />);

    const label = screen.getByLabelText("Click or drag to upload files.");

    // Create mock events
    const dragOverEvent = new Event("dragover", { bubbles: true });
    const dropEvent = new Event("drop", { bubbles: true });

    // Trigger events
    label.dispatchEvent(dragOverEvent);
    label.dispatchEvent(dropEvent);

    expect(defaultProps.handleDragOver).not.toHaveBeenCalled();
    expect(defaultProps.handleDrop).not.toHaveBeenCalled();
  });
});
