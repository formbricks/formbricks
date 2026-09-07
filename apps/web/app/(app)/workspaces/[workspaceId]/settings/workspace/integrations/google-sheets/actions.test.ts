import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getSpreadsheetNameById: vi.fn(),
  getIntegrationByType: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({ action: vi.fn((fn) => fn) })),
  },
}));

vi.mock("@/lib/authorization", () => ({
  assertCan: mocks.assertCan,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));

vi.mock("@/lib/googleSheet/service", () => ({
  getSpreadsheetNameById: mocks.getSpreadsheetNameById,
  validateGoogleSheetsConnection: vi.fn(),
}));

vi.mock("@/lib/integration/service", () => ({ getIntegrationByType: mocks.getIntegrationByType }));

const { getSpreadsheetNameByIdAction } = await import("./actions");

const call = (workspaceId: string) =>
  (getSpreadsheetNameByIdAction as unknown as (args: unknown) => Promise<unknown>)({
    ctx: { user: { id: "user1" } },
    parsedInput: { workspaceId, spreadsheetId: "sheet1" },
  });

const storedIntegration = {
  id: "integration1",
  type: "googleSheets",
  workspaceId: "ws1",
  config: {
    email: "owner@example.com",
    data: [],
    key: {
      scope: "https://www.googleapis.com/auth/spreadsheets",
      token_type: "Bearer",
      expiry_date: 123,
      access_token: "ya29.stored",
      refresh_token: "1//stored",
    },
  },
};

describe("getSpreadsheetNameByIdAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCan.mockResolvedValue(undefined);
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue("org1");
    mocks.getSpreadsheetNameById.mockResolvedValue("My Sheet");
    mocks.getIntegrationByType.mockResolvedValue(storedIntegration);
  });

  // ENG-2303: the settings page redacts config.key before the integration reaches the client, so the
  // action has to read the stored integration — with its real OAuth tokens — rather than take one from
  // the request.
  test("resolves the spreadsheet name using the stored integration for the authorized workspace", async () => {
    const result = await call("ws1");

    expect(mocks.getIntegrationByType).toHaveBeenCalledWith("ws1", "googleSheets");
    expect(mocks.getSpreadsheetNameById).toHaveBeenCalledWith(storedIntegration, "sheet1");
    expect(result).toBe("My Sheet");
  });

  test("throws when the workspace has no Google Sheets integration", async () => {
    mocks.getIntegrationByType.mockResolvedValue(null);

    await expect(call("ws1")).rejects.toThrow(ResourceNotFoundError);
    expect(mocks.getSpreadsheetNameById).not.toHaveBeenCalled();
  });
});
