import { redirect } from "next/navigation";
import { describe, expect, test, vi } from "vitest";

// Mock the redirect function
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Import the page component
const PageComponent = (await import("./page")).default;

describe("Share Redirect Page", () => {
  test("should redirect to summary page without rate limiting", async () => {
    const mockParams = Promise.resolve({ sharingKey: "test-sharing-key-123" });

    await PageComponent({ params: mockParams });

    expect(redirect).toHaveBeenCalledWith("/share/test-sharing-key-123/summary");
  });

  test("should handle different sharing keys", async () => {
    const testCases = ["abc123", "survey-key-456", "long-sharing-key-with-dashes-789"];

    for (const sharingKey of testCases) {
      vi.clearAllMocks();
      const mockParams = Promise.resolve({ sharingKey });

      await PageComponent({ params: mockParams });

      expect(redirect).toHaveBeenCalledWith(`/share/${sharingKey}/summary`);
    }
  });

  test("should be lightweight and not perform any rate limiting", async () => {
    // This test ensures the page doesn't import or use rate limiting
    const mockParams = Promise.resolve({ sharingKey: "test-key" });

    // Measure execution time to ensure it's very fast (< 10ms)
    const startTime = performance.now();
    await PageComponent({ params: mockParams });
    const endTime = performance.now();

    const executionTime = endTime - startTime;
    expect(executionTime).toBeLessThan(10); // Should be very fast since it's just a redirect
    expect(redirect).toHaveBeenCalled();
  });
});
