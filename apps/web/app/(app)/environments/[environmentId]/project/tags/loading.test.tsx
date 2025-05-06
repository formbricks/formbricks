import { TagsLoading as OriginalTagsLoading } from "@/modules/projects/settings/tags/loading";
import { describe, expect, test, vi } from "vitest";
import TagsLoading from "./loading";

// Mock the original component to ensure we are testing the re-export
vi.mock("@/modules/projects/settings/tags/loading", () => ({
  TagsLoading: () => <div data-testid="mock-tags-loading">Mock TagsLoading</div>,
}));

describe("TagsLoadingPage Re-export", () => {
  test("should re-export TagsLoading from the correct module", () => {
    // Check if the re-exported component is the same as the original (mocked) component
    expect(TagsLoading).toBe(OriginalTagsLoading);
  });
});
