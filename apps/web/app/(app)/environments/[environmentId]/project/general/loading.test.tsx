import { GeneralSettingsLoading as OriginalGeneralSettingsLoading } from "@/modules/projects/settings/general/loading";
import { describe, expect, test, vi } from "vitest";
import GeneralSettingsLoadingPage from "./loading";

// Mock the original component to ensure we are testing the re-export
vi.mock("@/modules/projects/settings/general/loading", () => ({
  GeneralSettingsLoading: () => (
    <div data-testid="mock-general-settings-loading">Mock GeneralSettingsLoading</div>
  ),
}));

describe("GeneralSettingsLoadingPage Re-export", () => {
  test("should re-export GeneralSettingsLoading from the correct module", () => {
    // Check if the re-exported component is the same as the original (mocked) component
    expect(GeneralSettingsLoadingPage).toBe(OriginalGeneralSettingsLoading);
  });
});
