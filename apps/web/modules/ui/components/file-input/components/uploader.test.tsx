import { showStorageNotConfiguredToast } from "@/modules/ui/components/storage-not-configured-toast/lib/utils";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TAllowedFileExtension } from "@formbricks/types/storage";
import { Uploader } from "./uploader";

vi.mock("@/modules/ui/components/storage-not-configured-toast/lib/utils", () => ({
  showStorageNotConfiguredToast: vi.fn(),
}));

describe("Uploader", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
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
    isStorageConfigured: true,
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

  describe("isStorageConfigured functionality", () => {
    test("allows file upload when isStorageConfigured=true", async () => {
      render(<Uploader {...defaultProps} isStorageConfigured={true} />);

      const fileInput = screen.getByTestId("upload-file-input");
      const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });

      await userEvent.upload(fileInput, file);

      expect(defaultProps.handleUpload).toHaveBeenCalledWith([file]);
      expect(showStorageNotConfiguredToast).not.toHaveBeenCalled();
    });

    test("shows storage not configured toast and prevents file upload when isStorageConfigured=false", async () => {
      render(<Uploader {...defaultProps} isStorageConfigured={false} />);

      const fileInput = screen.getByTestId("upload-file-input");
      const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });

      await userEvent.upload(fileInput, file);

      expect(showStorageNotConfiguredToast).toHaveBeenCalled();
      expect(defaultProps.handleUpload).not.toHaveBeenCalled();
    });

    test("shows storage not configured toast on drag over when isStorageConfigured=false", () => {
      render(<Uploader {...defaultProps} isStorageConfigured={false} />);

      const label = screen.getByTestId("upload-file-label");
      const dragOverEvent = new Event("dragover", { bubbles: true });

      label.dispatchEvent(dragOverEvent);

      expect(showStorageNotConfiguredToast).toHaveBeenCalled();
      expect(defaultProps.handleDragOver).not.toHaveBeenCalled();
    });

    test("allows drag over when isStorageConfigured=true", () => {
      render(<Uploader {...defaultProps} isStorageConfigured={true} />);

      const label = screen.getByTestId("upload-file-label");
      const dragOverEvent = new Event("dragover", { bubbles: true });

      label.dispatchEvent(dragOverEvent);

      expect(defaultProps.handleDragOver).toHaveBeenCalled();
      expect(showStorageNotConfiguredToast).not.toHaveBeenCalled();
    });

    test("shows storage not configured toast on drop when isStorageConfigured=false", () => {
      render(<Uploader {...defaultProps} isStorageConfigured={false} />);

      const label = screen.getByTestId("upload-file-label");
      const dropEvent = new Event("drop", { bubbles: true });

      label.dispatchEvent(dropEvent);

      expect(showStorageNotConfiguredToast).toHaveBeenCalled();
      expect(defaultProps.handleDrop).not.toHaveBeenCalled();
    });

    test("allows drop when isStorageConfigured=true", () => {
      render(<Uploader {...defaultProps} isStorageConfigured={true} />);

      const label = screen.getByTestId("upload-file-label");
      const dropEvent = new Event("drop", { bubbles: true });

      label.dispatchEvent(dropEvent);

      expect(defaultProps.handleDrop).toHaveBeenCalled();
      expect(showStorageNotConfiguredToast).not.toHaveBeenCalled();
    });

    test("shows storage not configured toast on click when isStorageConfigured=false", async () => {
      render(<Uploader {...defaultProps} isStorageConfigured={false} />);

      const label = screen.getByTestId("upload-file-label");

      await userEvent.click(label);

      expect(showStorageNotConfiguredToast).toHaveBeenCalled();
    });

    test("does not show storage toast on click when isStorageConfigured=true", async () => {
      render(<Uploader {...defaultProps} isStorageConfigured={true} />);

      const label = screen.getByTestId("upload-file-label");

      await userEvent.click(label);

      expect(showStorageNotConfiguredToast).not.toHaveBeenCalled();
    });

    test("does not call drag handlers when storage not configured and disabled", () => {
      render(<Uploader {...defaultProps} isStorageConfigured={false} disabled={true} />);

      const label = screen.getByTestId("upload-file-label");
      const dragOverEvent = new Event("dragover", { bubbles: true });
      const dropEvent = new Event("drop", { bubbles: true });

      label.dispatchEvent(dragOverEvent);
      label.dispatchEvent(dropEvent);

      // Storage toast should still be called even when disabled
      expect(showStorageNotConfiguredToast).toHaveBeenCalledTimes(2);
      expect(defaultProps.handleDragOver).not.toHaveBeenCalled();
      expect(defaultProps.handleDrop).not.toHaveBeenCalled();
    });

    test("handles multiple file upload when isStorageConfigured=true", async () => {
      render(<Uploader {...defaultProps} isStorageConfigured={true} multiple={true} />);

      const fileInput = screen.getByTestId("upload-file-input");
      const files = [
        new File(["test1"], "test1.jpg", { type: "image/jpeg" }),
        new File(["test2"], "test2.png", { type: "image/png" }),
      ];

      await userEvent.upload(fileInput, files);

      expect(defaultProps.handleUpload).toHaveBeenCalledWith(files);
      expect(showStorageNotConfiguredToast).not.toHaveBeenCalled();
    });

    test("prevents multiple file upload when isStorageConfigured=false", async () => {
      render(<Uploader {...defaultProps} isStorageConfigured={false} multiple={true} />);

      const fileInput = screen.getByTestId("upload-file-input");
      const files = [
        new File(["test1"], "test1.jpg", { type: "image/jpeg" }),
        new File(["test2"], "test2.png", { type: "image/png" }),
      ];

      await userEvent.upload(fileInput, files);

      expect(showStorageNotConfiguredToast).toHaveBeenCalled();
      expect(defaultProps.handleUpload).not.toHaveBeenCalled();
    });

    test("shows storage toast when trying to upload with empty file list and storage not configured", async () => {
      render(<Uploader {...defaultProps} isStorageConfigured={false} />);

      const fileInput = screen.getByTestId("upload-file-input");

      // Simulate selecting no files (empty file list)
      Object.defineProperty(fileInput, "files", {
        value: [],
        configurable: true,
      });

      await userEvent.click(fileInput);

      // Manually trigger the onChange event with empty files
      const changeEvent = new Event("change", { bubbles: true });
      fileInput.dispatchEvent(changeEvent);

      expect(showStorageNotConfiguredToast).toHaveBeenCalled();
    });
  });
});
