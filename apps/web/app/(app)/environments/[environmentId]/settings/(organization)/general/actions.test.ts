import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, OperationNotAllowedError } from "@formbricks/types/errors";
import { updateOrganizationAISettingsAction } from "./actions";
import { ZOrganizationAISettingsInput } from "./schemas";

const mocks = vi.hoisted(() => ({
  isInstanceAIConfigured: vi.fn(),
  checkAuthorizationUpdated: vi.fn(),
  deleteOrganization: vi.fn(),
  getOrganization: vi.fn(),
  getIsMultiOrgEnabled: vi.fn(),
  getTranslate: vi.fn(),
  updateOrganization: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({
      action: vi.fn((fn) => fn),
    })),
  },
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: mocks.checkAuthorizationUpdated,
}));

vi.mock("@/lib/organization/service", () => ({
  deleteOrganization: mocks.deleteOrganization,
  getOrganization: mocks.getOrganization,
  updateOrganization: mocks.updateOrganization,
}));

vi.mock("@/lib/ai/service", () => ({
  isInstanceAIConfigured: mocks.isInstanceAIConfigured,
}));

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: mocks.getTranslate,
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsMultiOrgEnabled: mocks.getIsMultiOrgEnabled,
}));

const organizationId = "cm9gptbhg0000192zceq9ayuc";

describe("organization AI settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.checkAuthorizationUpdated.mockResolvedValue(undefined);
    mocks.getOrganization.mockResolvedValue({
      id: organizationId,
      isAISmartToolsEnabled: false,
      isAIDataAnalysisEnabled: false,
    });
    mocks.isInstanceAIConfigured.mockReturnValue(true);
    mocks.getTranslate.mockResolvedValue((key: string, values?: Record<string, string>) =>
      values ? `${key}:${JSON.stringify(values)}` : key
    );
    mocks.updateOrganization.mockResolvedValue({
      id: organizationId,
      isAISmartToolsEnabled: true,
      isAIDataAnalysisEnabled: false,
    });
    mocks.getIsMultiOrgEnabled.mockResolvedValue(true);
  });

  test("accepts AI toggle updates", () => {
    expect(
      ZOrganizationAISettingsInput.parse({
        isAISmartToolsEnabled: true,
      })
    ).toEqual({
      isAISmartToolsEnabled: true,
    });
  });

  test("passes owner and manager roles to the authorization check and updates organization settings", async () => {
    const ctx = {
      user: { id: "user_1", locale: "en-US" },
      auditLoggingCtx: {},
    };
    const parsedInput = {
      organizationId,
      data: {
        isAISmartToolsEnabled: true,
      },
    };

    const result = await updateOrganizationAISettingsAction({ ctx, parsedInput } as any);

    expect(mocks.checkAuthorizationUpdated).toHaveBeenCalledWith({
      userId: "user_1",
      organizationId,
      access: [
        {
          type: "organization",
          schema: ZOrganizationAISettingsInput,
          data: parsedInput.data,
          roles: ["owner", "manager"],
        },
      ],
    });
    expect(mocks.getOrganization).toHaveBeenCalledWith(organizationId);
    expect(mocks.updateOrganization).toHaveBeenCalledWith(organizationId, parsedInput.data);
    expect(ctx.auditLoggingCtx).toMatchObject({
      organizationId,
      oldObject: {
        id: organizationId,
        isAISmartToolsEnabled: false,
        isAIDataAnalysisEnabled: false,
      },
      newObject: {
        id: organizationId,
        isAISmartToolsEnabled: true,
        isAIDataAnalysisEnabled: false,
      },
    });
    expect(result).toEqual({
      id: organizationId,
      isAISmartToolsEnabled: true,
      isAIDataAnalysisEnabled: false,
    });
  });

  test("propagates authorization failures so members cannot update AI settings", async () => {
    mocks.checkAuthorizationUpdated.mockRejectedValueOnce(new AuthorizationError("Not authorized"));

    await expect(
      updateOrganizationAISettingsAction({
        ctx: {
          user: { id: "user_member", locale: "en-US" },
          auditLoggingCtx: {},
        },
        parsedInput: {
          organizationId,
          data: {
            isAISmartToolsEnabled: true,
          },
        },
      } as any)
    ).rejects.toThrow(AuthorizationError);

    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });

  test("rejects enabling AI when the instance AI provider is not configured", async () => {
    mocks.isInstanceAIConfigured.mockReturnValueOnce(false);

    await expect(
      updateOrganizationAISettingsAction({
        ctx: {
          user: { id: "user_owner", locale: "en-US" },
          auditLoggingCtx: {},
        },
        parsedInput: {
          organizationId,
          data: {
            isAISmartToolsEnabled: true,
          },
        },
      } as any)
    ).rejects.toThrow(OperationNotAllowedError);

    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });

  test("allows enabling AI when the instance configuration is valid", async () => {
    await updateOrganizationAISettingsAction({
      ctx: {
        user: { id: "user_owner", locale: "en-US" },
        auditLoggingCtx: {},
      },
      parsedInput: {
        organizationId,
        data: {
          isAISmartToolsEnabled: true,
        },
      },
    } as any);

    expect(mocks.updateOrganization).toHaveBeenCalledWith(organizationId, {
      isAISmartToolsEnabled: true,
    });
  });

  test("allows disabling AI when the instance configuration later becomes invalid", async () => {
    mocks.getOrganization.mockResolvedValueOnce({
      id: organizationId,
      isAISmartToolsEnabled: true,
      isAIDataAnalysisEnabled: false,
    });
    mocks.isInstanceAIConfigured.mockReturnValueOnce(false);

    await updateOrganizationAISettingsAction({
      ctx: {
        user: { id: "user_owner", locale: "en-US" },
        auditLoggingCtx: {},
      },
      parsedInput: {
        organizationId,
        data: {
          isAISmartToolsEnabled: false,
        },
      },
    } as any);

    expect(mocks.updateOrganization).toHaveBeenCalledWith(organizationId, {
      isAISmartToolsEnabled: false,
    });
  });
});
