import { LanguagesLoading as OriginalLanguagesLoading } from "@/modules/ee/languages/loading";
import { describe, expect, test, vi } from "vitest";
import LanguagesLoading from "./loading";

// Mock the original component to ensure we are testing the re-export
vi.mock("@/modules/ee/languages/loading", () => ({
  LanguagesLoading: () => <div data-testid="mock-languages-loading">Mock LanguagesLoading</div>,
}));

describe("LanguagesLoadingPage Re-export", () => {
  test("should re-export LanguagesLoading from the correct module", () => {
    // Check if the re-exported component is the same as the original (mocked) component
    expect(LanguagesLoading).toBe(OriginalLanguagesLoading);
  });
});
