import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TAllowedFileExtension } from "@formbricks/types/storage";
import { Uploader } from "./components/uploader";
import { FileInput } from "./index";

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
  },
  error: vi.fn(),
}));

// Mock dependencies
vi.mock("@/modules/storage/file-upload", () => ({
  FileUploadError: { INVALID_FILE_NAME: "Invalid file name. Please rename your file and try again." },
  handleFileUpload: vi.fn().mockResolvedValue({ url: "https://example.com/uploaded-file.jpg" }),
}));

vi.mock("./lib/utils", () => ({
  getAllowedFiles: vi.fn().mockImplementation((files) => Promise.resolve(files)),
  checkForYoutubePrivacyMode: vi.fn().mockReturnValue(false),
}));

vi.mock("./components/uploader", () => ({
  Uploader: vi.fn(({ children, disabled, ...props }) => (
    <div data-testid="uploader-mock" {...props}>
      {children || "Click or drag to upload files."}
      <input data-testid="upload-file-input" type="file" style={{ display: "none" }} disabled={disabled} />
    </div>
  )),
}));

describe("FileInput", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps = {
    id: "test-file-input",
    allowedFileExtensions: ["jpg", "png", "pdf"] as TAllowedFileExtension[],
    environmentId: "env-123",
    onFileUpload: vi.fn(),
    isStorageConfigured: true,
  };

  test("renders uploader component when no files are selected", () => {
    render(<FileInput {...defaultProps} />);
    expect(screen.getByText("Click or drag to upload files.")).toBeInTheDocument();
  });

  test("shows image/video toggle when isVideoAllowed is true", () => {
    render(<FileInput {...defaultProps} isVideoAllowed={true} />);
    expect(screen.getByText("common.image")).toBeInTheDocument();
    expect(screen.getByText("common.video")).toBeInTheDocument();
  });

  test("shows video settings when video tab is active", async () => {
    render(<FileInput {...defaultProps} isVideoAllowed={true} />);

    // Click on video tab
    await userEvent.click(screen.getByText("common.video"));

    // Check if VideoSettings component is rendered
    expect(screen.getByPlaceholderText("https://www.youtube.com/watch?v=VIDEO_ID")).toBeInTheDocument();
  });

  test("shows invalid filename toast when upload returns INVALID_FILE_NAME", async () => {
    const mod = await import("@/modules/storage/file-upload");
    vi.mocked(mod.handleFileUpload as any).mockResolvedValueOnce({
      error: mod.FileUploadError.INVALID_FILE_NAME,
      url: "",
    });

    render(<FileInput {...defaultProps} />);

    // Get the handleUpload function passed to the mocked Uploader
    const uploaderCall = vi.mocked(Uploader).mock.calls[0][0];
    const handleUpload = uploaderCall.handleUpload;

    // Create test file and mock getAllowedFiles to return it
    const file = new File(["dummy"], "----.png", { type: "image/png" });
    const utils = await import("./lib/utils");
    vi.mocked(utils.getAllowedFiles as any).mockResolvedValueOnce([file]);

    // Call the handleUpload function directly
    await handleUpload([file]);

    // allow async handlers to finish
    await new Promise((r) => setTimeout(r, 0));

    expect((toast as any).error).toHaveBeenCalled();
  });

  test("displays existing file when fileUrl is provided", () => {
    const fileUrl = "https://example.com/test-image.jpg";
    render(<FileInput {...defaultProps} fileUrl={fileUrl} />);

    // Since Image component is mocked, we can't directly check the src attribute
    // But we can verify that the uploader is not showing
    expect(screen.queryByText("Click or drag to upload files.")).not.toBeInTheDocument();
  });

  test("handles multiple files when multiple prop is true", () => {
    const fileUrls = ["https://example.com/image1.jpg", "https://example.com/image2.jpg"];

    render(<FileInput {...defaultProps} multiple={true} fileUrl={fileUrls} />);

    // Should show upload more button for multiple files
    expect(screen.getByTestId("upload-file-input")).toBeInTheDocument();
  });

  test("applies disabled state correctly", () => {
    render(<FileInput {...defaultProps} disabled={true} />);

    const fileInput = screen.getByTestId("upload-file-input");
    expect(fileInput).toBeDisabled();
  });

  describe("isStorageConfigured functionality", () => {
    test("passes isStorageConfigured=true to Uploader component", () => {
      render(<FileInput {...defaultProps} isStorageConfigured={true} />);

      expect(vi.mocked(Uploader)).toHaveBeenCalledWith(
        expect.objectContaining({
          isStorageConfigured: true,
        }),
        undefined
      );
    });

    test("passes isStorageConfigured=false to Uploader component", () => {
      render(<FileInput {...defaultProps} isStorageConfigured={false} />);

      expect(vi.mocked(Uploader)).toHaveBeenCalledWith(
        expect.objectContaining({
          isStorageConfigured: false,
        }),
        undefined
      );
    });

    test("passes correct props to Uploader including isStorageConfigured", () => {
      render(<FileInput {...defaultProps} isStorageConfigured={false} disabled={true} />);

      expect(vi.mocked(Uploader)).toHaveBeenCalledWith(
        expect.objectContaining({
          isStorageConfigured: false,
          disabled: true,
          multiple: false,
        }),
        undefined
      );
    });

    test("passes uploadMore=true to Uploader when multiple files are present", () => {
      const fileUrls = ["https://example.com/image1.jpg"];

      render(<FileInput {...defaultProps} isStorageConfigured={true} multiple={true} fileUrl={fileUrls} />);

      // Check that the second call (uploadMore) has the correct props
      const calls = vi.mocked(Uploader).mock.calls;
      expect(calls.length).toBeGreaterThan(1);
      expect(calls[1][0]).toMatchObject({
        isStorageConfigured: true,
        uploadMore: true,
      });
    });
  });
});
