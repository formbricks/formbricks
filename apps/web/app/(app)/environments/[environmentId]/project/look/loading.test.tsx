import { ProjectLookSettingsLoading as OriginalProjectLookSettingsLoading } from "@/modules/projects/settings/look/loading";
import { describe, expect, test, vi } from "vitest";
import ProjectLookSettingsLoading from "./loading";

// Mock the original component to ensure we are testing the re-export
vi.mock("@/modules/projects/settings/look/loading", () => ({
  ProjectLookSettingsLoading: () => (
    <div data-testid="mock-project-look-settings-loading">Mock ProjectLookSettingsLoading</div>
  ),
}));

describe("ProjectLookSettingsLoadingPage Re-export", () => {
  test("should re-export ProjectLookSettingsLoading from the correct module", () => {
    // Check if the re-exported component is the same as the original (mocked) component
    expect(ProjectLookSettingsLoading).toBe(OriginalProjectLookSettingsLoading);
  });
});
