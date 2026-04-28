import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ValidationError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { TWorkspaceUpdateBrandingInput } from "../types/workspace";
import { updateWorkspaceBranding } from "./workspace";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("updateWorkspaceBranding", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should update workspace branding successfully", async () => {
    const mockWorkspace = {
      id: "test-workspace-id",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test Workspace",
      organizationId: "test-org-id",
      brandColor: null,
      highlightBorderColor: null,
      styling: {
        allowStyleOverwrite: true,
        brandColor: { light: "#64748b" },
        inputBorderColor: { light: "#cbd5e1" },
        cardBackgroundColor: { light: "#ffffff" },
        cardBorderColor: { light: "#f8fafc" },

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
      overlay: "none",
      languages: [],
      logo: null,
    };

    vi.mocked(prisma.workspace.update).mockResolvedValue(mockWorkspace as any);
    vi.mocked(validateInputs).mockReturnValue([
      "test-workspace-id",
      { linkSurveyBranding: false, inAppSurveyBranding: false },
    ]);

    const inputWorkspace: TWorkspaceUpdateBrandingInput = {
      linkSurveyBranding: false,
      inAppSurveyBranding: false,
    };

    const result = await updateWorkspaceBranding("test-workspace-id", inputWorkspace);

    expect(result).toBe(true);
    expect(validateInputs).toHaveBeenCalledWith(
      ["test-workspace-id", expect.any(Object)],
      [inputWorkspace, expect.any(Object)]
    );
    expect(prisma.workspace.update).toHaveBeenCalledWith({
      where: {
        id: "test-workspace-id",
      },
      data: inputWorkspace,
      select: {
        id: true,
        organizationId: true,
      },
    });
  });

  test("should throw ValidationError when validation fails", async () => {
    vi.mocked(validateInputs).mockImplementation(() => {
      throw new ValidationError("Validation failed");
    });

    const inputWorkspace: TWorkspaceUpdateBrandingInput = {
      linkSurveyBranding: false,
      inAppSurveyBranding: false,
    };

    await expect(updateWorkspaceBranding("test-workspace-id", inputWorkspace)).rejects.toThrow(
      ValidationError
    );
    expect(prisma.workspace.update).not.toHaveBeenCalled();
  });

  test("should throw ValidationError when prisma update fails", async () => {
    vi.mocked(validateInputs).mockReturnValue([
      "test-workspace-id",
      { linkSurveyBranding: false, inAppSurveyBranding: false },
    ]);
    vi.mocked(prisma.workspace.update).mockRejectedValue(new Error("Database error"));

    const inputWorkspace: TWorkspaceUpdateBrandingInput = {
      linkSurveyBranding: false,
      inAppSurveyBranding: false,
    };

    await expect(updateWorkspaceBranding("test-workspace-id", inputWorkspace)).rejects.toThrow(
      ValidationError
    );
  });
});
