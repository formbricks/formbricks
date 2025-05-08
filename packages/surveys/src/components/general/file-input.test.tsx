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
});
