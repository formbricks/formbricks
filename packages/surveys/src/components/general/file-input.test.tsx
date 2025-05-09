import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileInput } from "./file-input";

// Mock auto-animate hook to prevent React useState errors in Preact tests
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [() => {}],
}));
// Mock storage helper to return file URL as filename
vi.mock("@/lib/storage", () => ({
  getOriginalFileNameFromUrl: (url: string) => url,
}));

// Helper to create a file of given size and type
const createFile = (name: string, size = 1000, type = "text/plain"): File => {
  const blob = new Blob(["a".repeat(size)], { type });
  const file = new File([blob], name, { type });
  // Polyfill arrayBuffer for tests
  (file as any).arrayBuffer = async () => new Uint8Array(size).buffer;
  return file;
};

describe("FileInput", () => {
  let onFileUpload: ReturnType<typeof vi.fn>;
  let onUploadCallback: ReturnType<typeof vi.fn>;
  let alertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    onFileUpload = vi.fn().mockResolvedValue("uploaded-url");
    onUploadCallback = vi.fn();
    alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uploads valid file and calls callbacks", async () => {
    render(
      <FileInput
        surveyId="survey1"
        onFileUpload={onFileUpload}
        onUploadCallback={onUploadCallback}
        fileUrls={[]}
        allowedFileExtensions={["plain"]}
        maxSizeInMB={1}
        allowMultipleFiles={true}
      />
    );
    const input = screen.getByLabelText("File upload");
    const file = createFile("test.txt", 500, "text/plain");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onFileUpload).toHaveBeenCalledWith(expect.objectContaining({ name: "test.txt" }), {
        allowedFileExtensions: ["plain"],
        surveyId: "survey1",
      });
      expect(onUploadCallback).toHaveBeenCalledWith(["uploaded-url"]);
    });
  });

  it("alerts on invalid file type", async () => {
    render(
      <FileInput
        surveyId="survey1"
        onFileUpload={onFileUpload}
        onUploadCallback={onUploadCallback}
        fileUrls={[]}
        allowedFileExtensions={["pdf"]}
        allowMultipleFiles={true}
      />
    );
    const input = screen.getByLabelText("File upload");
    const file = createFile("image.jpg", 1000, "image/jpeg");
    fireEvent.change(input, { target: { files: [file] } });

    expect(alertSpy).toHaveBeenCalledWith("No valid file types selected. Please select a valid file type.");
    expect(onFileUpload).not.toHaveBeenCalled();
    expect(onUploadCallback).not.toHaveBeenCalled();
  });

  it("alerts when multiple files not allowed", () => {
    render(
      <FileInput
        surveyId="survey1"
        onFileUpload={onFileUpload}
        onUploadCallback={onUploadCallback}
        fileUrls={[]}
        allowMultipleFiles={false}
      />
    );
    const input = screen.getByLabelText("File upload");
    const files = [createFile("one.txt", 500, "text/plain"), createFile("two.txt", 500, "text/plain")];
    fireEvent.change(input, { target: { files } });

    expect(alertSpy).toHaveBeenCalledWith("Only one file can be uploaded at a time.");
    expect(onFileUpload).not.toHaveBeenCalled();
  });

  it("renders existing fileUrls and handles delete", () => {
    const initialUrls = ["fileA.txt", "fileB.txt"];
    render(
      <FileInput
        surveyId="survey1"
        onFileUpload={onFileUpload}
        onUploadCallback={onUploadCallback}
        fileUrls={initialUrls}
        allowedFileExtensions={["plain"]}
        allowMultipleFiles={true}
      />
    );
    expect(screen.getByText("fileA.txt")).toBeInTheDocument();
    expect(screen.getByText("fileB.txt")).toBeInTheDocument();
    const deleteBtn = screen.getByLabelText("Delete file fileA.txt");
    const svg = deleteBtn.querySelector("svg");
    if (!svg) throw new Error("Delete SVG not found");
    fireEvent.click(svg);
    expect(onUploadCallback).toHaveBeenCalledWith(["fileB.txt"]);
  });

  it("alerts when duplicate files selected", () => {
    render(
      <FileInput
        surveyId="survey1"
        onFileUpload={onFileUpload}
        onUploadCallback={onUploadCallback}
        fileUrls={["dup.txt"]}
        allowedFileExtensions={["plain"]}
        allowMultipleFiles={true}
      />
    );
    const input = screen.getByLabelText("File upload");
    const dupFile = createFile("dup.txt", 500, "text/plain");
    fireEvent.change(input, { target: { files: [dupFile] } });
    expect(alertSpy).toHaveBeenCalledWith(
      "The following files are already uploaded: dup.txt. Duplicate files are not allowed."
    );
  });

  it("handles native file upload event", async () => {
    // Import the actual constant to ensure we're using the right event name
    const FILE_PICK_EVENT = "formbricks:onFilePick";
    const nativeFile = { name: "native.txt", type: "text/plain", base64: btoa("native content") };

    render(
      <FileInput
        surveyId="survey1"
        onFileUpload={onFileUpload}
        onUploadCallback={onUploadCallback}
        fileUrls={[]}
        allowedFileExtensions={["plain"]}
        maxSizeInMB={1}
        allowMultipleFiles={true}
      />
    );

    // Create and dispatch the event with the correct name
    const event = new CustomEvent(FILE_PICK_EVENT, { detail: [nativeFile] });
    window.dispatchEvent(event);

    // Wait for the upload to complete
    await waitFor(() => {
      expect(onFileUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "native.txt",
          type: "text/plain",
          base64: expect.any(String),
        }),
        expect.any(Object)
      );
    });
  });

  it("tests file size validation", async () => {
    // Instead of testing the alert directly, test that large files don't get uploaded
    const largeFile = createFile("large.txt", 2 * 1024 * 1024, "text/plain"); // 2MB file
    const smallFile = createFile("small.txt", 500, "text/plain"); // 500B file

    render(
      <FileInput
        surveyId="survey1"
        onFileUpload={onFileUpload}
        onUploadCallback={onUploadCallback}
        fileUrls={[]}
        allowedFileExtensions={["plain"]}
        maxSizeInMB={1}
        allowMultipleFiles={true}
      />
    );

    // Upload a small file first to verify normal behavior
    const input = screen.getByLabelText("File upload");
    fireEvent.change(input, { target: { files: [smallFile] } });

    await waitFor(() => {
      expect(onFileUpload).toHaveBeenCalledWith(
        expect.objectContaining({ name: "small.txt" }),
        expect.any(Object)
      );
    });

    // Reset mocks
    vi.clearAllMocks();

    // Now try with a large file
    fireEvent.change(input, { target: { files: [largeFile] } });

    // Wait a bit to ensure async operations complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The large file should not be uploaded
    expect(onFileUpload).not.toHaveBeenCalled();
  });

  it("does not upload when no valid files are selected", async () => {
    render(
      <FileInput
        surveyId="survey1"
        onFileUpload={onFileUpload}
        onUploadCallback={onUploadCallback}
        fileUrls={[]}
        allowedFileExtensions={["pdf"]}
        allowMultipleFiles={true}
      />
    );

    const input = screen.getByLabelText("File upload");
    const invalidFile = createFile("invalid.txt", 500, "text/plain");
    fireEvent.change(input, { target: { files: [invalidFile] } });

    expect(alertSpy).toHaveBeenCalledWith("No valid file types selected. Please select a valid file type.");
    expect(onFileUpload).not.toHaveBeenCalled();
  });

  it("does not upload duplicates", async () => {
    render(
      <FileInput
        surveyId="survey1"
        onFileUpload={onFileUpload}
        onUploadCallback={onUploadCallback}
        fileUrls={["dup.txt"]}
        allowedFileExtensions={["plain"]}
        allowMultipleFiles={true}
      />
    );

    const input = screen.getByLabelText("File upload");
    const dupFile = createFile("dup.txt", 500, "text/plain");
    fireEvent.change(input, { target: { files: [dupFile] } });

    expect(alertSpy).toHaveBeenCalledWith(
      "The following files are already uploaded: dup.txt. Duplicate files are not allowed."
    );
    expect(onFileUpload).not.toHaveBeenCalled();
  });

  it("handles native file upload with size limits", async () => {
    // Import the actual constant to ensure we're using the right event name
    const FILE_PICK_EVENT = "formbricks:onFilePick";

    // Create a large file that exceeds the limit
    const largeBase64 = btoa("a".repeat(1024 * 1024)); // ~1MB in base64
    const largeFile = { name: "large.txt", type: "text/plain", base64: largeBase64 };

    // Create a small file that's within the limit
    const smallFile = { name: "small.txt", type: "text/plain", base64: btoa("small content") };

    render(
      <FileInput
        surveyId="survey1"
        onFileUpload={onFileUpload}
        onUploadCallback={onUploadCallback}
        fileUrls={[]}
        allowedFileExtensions={["plain"]}
        maxSizeInMB={0.5} // 500KB limit
        allowMultipleFiles={true}
      />
    );

    // Dispatch event with both files
    const event = new CustomEvent(FILE_PICK_EVENT, { detail: [largeFile, smallFile] });
    window.dispatchEvent(event);

    // Check that the alert for rejected files was shown
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("exceed the maximum size of 0.5 MB"));
    });

    // Only the small file should be uploaded
    expect(onFileUpload).toHaveBeenCalledTimes(1);
    expect(onFileUpload).toHaveBeenCalledWith(
      expect.objectContaining({ name: "small.txt" }),
      expect.any(Object)
    );
  });

  it("handles case when no files remain after filtering", async () => {
    // Import the actual constant
    const FILE_PICK_EVENT = "formbricks:onFilePick";

    // Create a file that will be filtered out (too large)
    const largeBase64 = btoa("a".repeat(1024 * 1024)); // ~1MB in base64
    const largeFile = { name: "large.txt", type: "text/plain", base64: largeBase64 };

    render(
      <FileInput
        surveyId="survey1"
        onFileUpload={onFileUpload}
        onUploadCallback={onUploadCallback}
        fileUrls={[]}
        allowedFileExtensions={["plain"]}
        maxSizeInMB={0.1} // Very small limit to ensure filtering
        allowMultipleFiles={true}
      />
    );

    // Dispatch event with only the large file
    const event = new CustomEvent(FILE_PICK_EVENT, { detail: [largeFile] });
    window.dispatchEvent(event);

    // Check that the alert was shown
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });

    // No files should be uploaded
    expect(onFileUpload).not.toHaveBeenCalled();
    expect(onUploadCallback).not.toHaveBeenCalled();
  });

  it("deletes a file", () => {
    const initialUrls = ["fileA.txt", "fileB.txt"];
    render(
      <FileInput
        surveyId="survey1"
        onFileUpload={onFileUpload}
        onUploadCallback={onUploadCallback}
        fileUrls={initialUrls}
        allowedFileExtensions={["plain"]}
        allowMultipleFiles={true}
      />
    );

    const deleteBtn = screen.getByLabelText("Delete file fileA.txt");
    const svg = deleteBtn.querySelector("svg");
    if (!svg) throw new Error("Delete SVG not found");
    fireEvent.click(svg);

    expect(onUploadCallback).toHaveBeenCalledWith(["fileB.txt"]);
  });

  it("handles drag and drop", async () => {
    render(
      <FileInput
        surveyId="survey1"
        onFileUpload={onFileUpload}
        onUploadCallback={onUploadCallback}
        fileUrls={[]}
        allowedFileExtensions={["plain"]}
        allowMultipleFiles={true}
      />
    );

    const label = screen.getByLabelText("Upload files by clicking or dragging them here").closest("label");
    if (!label) throw new Error("Label not found");

    // Create a mock file and DataTransfer object
    const file = createFile("dropped.txt", 500, "text/plain");
    const dataTransfer = {
      files: [file],
      dropEffect: "",
    };

    // Simulate dragover event
    fireEvent.dragOver(label, { dataTransfer });
    expect(dataTransfer.dropEffect).toBe("copy");

    // Simulate drop event
    fireEvent.drop(label, { dataTransfer });

    await waitFor(() => {
      expect(onFileUpload).toHaveBeenCalledWith(
        expect.objectContaining({ name: "dropped.txt" }),
        expect.any(Object)
      );
    });
  });

  it("handles file upload errors", async () => {
    // Mock the toBase64 function to fail by making onFileUpload throw an error
    // during the Promise.all for uploadPromises
    onFileUpload.mockImplementationOnce(() => {
      throw new Error("Upload failed");
    });

    render(
      <FileInput
        surveyId="survey1"
        onFileUpload={onFileUpload}
        onUploadCallback={onUploadCallback}
        fileUrls={[]}
        allowedFileExtensions={["plain"]}
        maxSizeInMB={1}
        allowMultipleFiles={true}
      />
    );

    const input = screen.getByLabelText("File upload");
    const file = createFile("error.txt", 500, "text/plain");

    fireEvent.change(input, { target: { files: [file] } });

    // Wait for the alert to be called
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Upload failed! Please try again.");
    });
  });

  it("enforces file limit", () => {
    render(
      <FileInput
        surveyId="survey1"
        onFileUpload={onFileUpload}
        onUploadCallback={onUploadCallback}
        fileUrls={[]}
        allowedFileExtensions={["plain"]}
        allowMultipleFiles={true}
      />
    );

    // Create more files than the limit (25)
    const files = Array(26)
      .fill(null)
      .map((_, i) => createFile(`file${i}.txt`, 500, "text/plain"));
    const input = screen.getByLabelText("File upload");

    fireEvent.change(input, { target: { files } });

    expect(alertSpy).toHaveBeenCalledWith("You can only upload a maximum of 25 files.");
    expect(onFileUpload).not.toHaveBeenCalled();
  });
});
