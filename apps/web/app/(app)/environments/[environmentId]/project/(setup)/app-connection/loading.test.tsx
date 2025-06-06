import { AppConnectionLoading as OriginalAppConnectionLoading } from "@/modules/projects/settings/(setup)/app-connection/loading";
import { describe, expect, test, vi } from "vitest";
import AppConnectionLoading from "./loading";

// Mock the original component to ensure we are testing the re-export
vi.mock("@/modules/projects/settings/(setup)/app-connection/loading", () => ({
  AppConnectionLoading: () => <div data-testid="mock-app-connection-loading">Mock AppConnectionLoading</div>,
}));

describe("AppConnectionLoading Re-export", () => {
  test("should re-export AppConnectionLoading from the correct module", () => {
    // Check if the re-exported component is the same as the original (mocked) component
    expect(AppConnectionLoading).toBe(OriginalAppConnectionLoading);
  });
});
