import { validateInputs } from "@/lib/utils/validate";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ValidationError } from "@formbricks/types/errors";
import { TProjectUpdateBrandingInput } from "../types/project";
import { updateProjectBranding } from "./project";

vi.mock("@formbricks/database", () => ({
  prisma: {
    project: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("updateProjectBranding", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should update project branding successfully", async () => {
    const mockProject = {
      id: "test-project-id",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Project",
      organizationId: "test-org-id",
      brandColor: null,
      highlightBorderColor: null,
      styling: {
        allowStyleOverwrite: true,
        brandColor: { light: "#64748b" },
        questionColor: { light: "#2b2524" },
        inputColor: { light: "#ffffff" },
        inputBorderColor: { light: "#cbd5e1" },
        cardBackgroundColor: { light: "#ffffff" },
        cardBorderColor: { light: "#f8fafc" },
        cardShadowColor: { light: "#000000" },
        isLogoHidden: false,
        isDarkModeEnabled: false,
        background: { bg: "#fff", bgType: "color" as const },
        roundness: 8,
        cardArrangement: {
          linkSurveys: "straight" as const,
          appSurveys: "straight" as const,
        },
      },
      recontactDays: 7,
      linkSurveyBranding: true,
      inAppSurveyBranding: true,
      config: {
        channel: "link" as const,
        industry: "other" as const,
      },
      placement: "bottomRight" as const,
      clickOutsideClose: true,
      darkOverlay: false,
      environments: [{ id: "test-env-id" }],
      languages: [],
      logo: null,
    };

    vi.mocked(prisma.project.update).mockResolvedValue(mockProject);
    vi.mocked(validateInputs).mockReturnValue([
      "test-project-id",
      { linkSurveyBranding: false, inAppSurveyBranding: false },
    ]);

    const inputProject: TProjectUpdateBrandingInput = {
      linkSurveyBranding: false,
      inAppSurveyBranding: false,
    };

    const result = await updateProjectBranding("test-project-id", inputProject);

    expect(result).toBe(true);
    expect(validateInputs).toHaveBeenCalledWith(
      ["test-project-id", expect.any(Object)],
      [inputProject, expect.any(Object)]
    );
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: {
        id: "test-project-id",
      },
      data: inputProject,
      select: {
        id: true,
        organizationId: true,
        environments: {
          select: {
            id: true,
          },
        },
      },
    });
  });

  test("should throw ValidationError when validation fails", async () => {
    vi.mocked(validateInputs).mockImplementation(() => {
      throw new ValidationError("Validation failed");
    });

    const inputProject: TProjectUpdateBrandingInput = {
      linkSurveyBranding: false,
      inAppSurveyBranding: false,
    };

    await expect(updateProjectBranding("test-project-id", inputProject)).rejects.toThrow(ValidationError);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  test("should throw ValidationError when prisma update fails", async () => {
    vi.mocked(validateInputs).mockReturnValue([
      "test-project-id",
      { linkSurveyBranding: false, inAppSurveyBranding: false },
    ]);
    vi.mocked(prisma.project.update).mockRejectedValue(new Error("Database error"));

    const inputProject: TProjectUpdateBrandingInput = {
      linkSurveyBranding: false,
      inAppSurveyBranding: false,
    };

    await expect(updateProjectBranding("test-project-id", inputProject)).rejects.toThrow(ValidationError);
  });
});
