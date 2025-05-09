import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FileUploadResponse } from "./index";

// Mock dependencies
vi.mock("@/lib/storage/utils", () => ({
  getOriginalFileNameFromUrl: vi.fn().mockImplementation((url) => {
    if (url === "http://example.com/file.pdf") {
      return "file.pdf";
    }
    if (url === "http://example.com/image.jpg") {
      return "image.jpg";
    }
    return null;
  }),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (key: string) => (key === "common.skipped" ? "Skipped" : key) }),
}));

describe("FileUploadResponse", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders skipped message when no files are selected", () => {
    render(<FileUploadResponse selected={[]} />);
    expect(screen.getByText("Skipped")).toBeInTheDocument();
  });

  test("renders 'Download' when filename cannot be extracted", () => {
    const fileUrls = ["http://example.com/unknown-file"];
    render(<FileUploadResponse selected={fileUrls} />);

    expect(screen.getByText("Download")).toBeInTheDocument();
  });

  test("renders link with correct url and attributes", () => {
    const fileUrl = "http://example.com/file.pdf";
    render(<FileUploadResponse selected={[fileUrl]} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", fileUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
