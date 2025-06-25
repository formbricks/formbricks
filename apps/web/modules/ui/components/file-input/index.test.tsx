import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TAllowedFileExtension } from "@formbricks/types/common";
import { FileInput } from "./index";

// Mock dependencies
vi.mock("@/app/lib/fileUpload", () => ({
  handleFileUpload: vi.fn().mockResolvedValue({ url: "https://example.com/uploaded-file.jpg" }),
}));

vi.mock("./lib/utils", () => ({
  getAllowedFiles: vi.fn().mockImplementation((files) => Promise.resolve(files)),
  checkForYoutubePrivacyMode: vi.fn().mockReturnValue(false),
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
});
