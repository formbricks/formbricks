import { beforeEach, describe, expect, test, vi } from "vitest";
import { getAISmartToolsUnavailableReason, getOrganizationAIConfig } from "@/lib/ai/service";
import { getSurveyAIAvailability } from "./get-survey-ai-availability";

vi.mock("@/lib/ai/service", () => ({
  getAISmartToolsUnavailableReason: vi.fn(),
  getOrganizationAIConfig: vi.fn(),
}));

describe("getSurveyAIAvailability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrganizationAIConfig).mockResolvedValue({
      organizationId: "org1",
      isAISmartToolsEnabled: true,
      isAISmartToolsEntitled: true,
      isInstanceConfigured: true,
    });
    vi.mocked(getAISmartToolsUnavailableReason).mockReturnValue(undefined);
  });

  test("returns read only when the user cannot create surveys", async () => {
    const result = await getSurveyAIAvailability("org1", { isReadOnly: true });

    expect(result).toEqual({ isAIAvailable: false, aiUnavailableReason: "read_only" });
    expect(getOrganizationAIConfig).not.toHaveBeenCalled();
  });

  test("returns available when organization AI config is usable", async () => {
    const result = await getSurveyAIAvailability("org1");

    expect(result).toEqual({ isAIAvailable: true, aiUnavailableReason: undefined });
    expect(getOrganizationAIConfig).toHaveBeenCalledWith("org1");
  });

  test("applies onboarding overrides before checking availability", async () => {
    vi.mocked(getAISmartToolsUnavailableReason).mockReturnValue("not_enabled");

    const result = await getSurveyAIAvailability("org1", {
      isAISmartToolsEnabled: false,
      isAISmartToolsEntitled: false,
    });

    expect(getAISmartToolsUnavailableReason).toHaveBeenCalledWith({
      organizationId: "org1",
      isAISmartToolsEnabled: false,
      isAISmartToolsEntitled: false,
      isInstanceConfigured: true,
    });
    expect(result).toEqual({ isAIAvailable: false, aiUnavailableReason: "not_enabled" });
  });
});
