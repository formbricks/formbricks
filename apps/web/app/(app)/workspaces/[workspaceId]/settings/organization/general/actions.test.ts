import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, OperationNotAllowedError } from "@formbricks/types/errors";
import {
  deleteOrganizationAction,
  updateOrganizationAISettingsAction,
  updateOrganizationDisplayTimeZoneAction,
  updateOrganizationNameAction,
} from "./actions";
import { ZOrganizationAISettingsInput, ZOrganizationDisplayTimeZoneInput } from "./schemas";

const mocks = vi.hoisted(() => ({
  isInstanceAIConfigured: vi.fn(),
  assertCan: vi.fn(),
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

vi.mock("@/lib/authorization", () => ({
  assertCan: mocks.assertCan,
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

    mocks.assertCan.mockResolvedValue(undefined);
    mocks.getOrganization.mockResolvedValue({
      id: organizationId,
      isAISmartToolsEnabled: false,
    });
    mocks.isInstanceAIConfigured.mockReturnValue(true);
    mocks.getTranslate.mockResolvedValue((key: string, values?: Record<string, string>) =>
      values ? `${key}:${JSON.stringify(values)}` : key
    );
    mocks.updateOrganization.mockResolvedValue({
      id: organizationId,
      isAISmartToolsEnabled: true,
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

  test("requires organization.manage and updates organization settings", async () => {
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

    expect(mocks.assertCan).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "organization.manage", {
      type: "organization",
      id: organizationId,
    });
    expect(mocks.getOrganization).toHaveBeenCalledWith(organizationId);
    expect(mocks.updateOrganization).toHaveBeenCalledWith(organizationId, parsedInput.data);
    expect(ctx.auditLoggingCtx).toMatchObject({
      organizationId,
      oldObject: {
        id: organizationId,
        isAISmartToolsEnabled: false,
      },
      newObject: {
        id: organizationId,
        isAISmartToolsEnabled: true,
      },
    });
    expect(result).toEqual({
      id: organizationId,
      isAISmartToolsEnabled: true,
    });
  });

  test("propagates authorization failures so members cannot update AI settings", async () => {
    mocks.assertCan.mockRejectedValueOnce(new AuthorizationError("Not authorized"));

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

  test("requires organization.write for organization name updates", async () => {
    const ctx = {
      user: { id: "user_owner", locale: "en-US" },
      auditLoggingCtx: {},
    };

    await updateOrganizationNameAction({
      ctx,
      parsedInput: {
        organizationId,
        data: { name: "Renamed organization" },
      },
    } as never);

    expect(mocks.assertCan).toHaveBeenCalledWith({ type: "user", id: "user_owner" }, "organization.write", {
      type: "organization",
      id: organizationId,
    });
  });

  test("requires organization.write for organization deletion", async () => {
    const ctx = {
      user: { id: "user_owner", locale: "en-US" },
      auditLoggingCtx: {},
    };

    await deleteOrganizationAction({
      ctx,
      parsedInput: { organizationId },
    } as never);

    expect(mocks.assertCan).toHaveBeenCalledWith({ type: "user", id: "user_owner" }, "organization.write", {
      type: "organization",
      id: organizationId,
    });
    expect(mocks.deleteOrganization).toHaveBeenCalledWith(organizationId);
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
