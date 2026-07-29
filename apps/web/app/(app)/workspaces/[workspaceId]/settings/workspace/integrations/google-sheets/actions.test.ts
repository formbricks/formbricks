import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";

const mocks = vi.hoisted(() => ({
  checkAuthorizationUpdated: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getSpreadsheetNameById: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({ action: vi.fn((fn) => fn) })),
  },
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: mocks.checkAuthorizationUpdated,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));

vi.mock("@/lib/googleSheet/service", () => ({
  getSpreadsheetNameById: mocks.getSpreadsheetNameById,
  validateGoogleSheetsConnection: vi.fn(),
}));

vi.mock("@/lib/integration/service", () => ({ getIntegrationByType: vi.fn() }));

const { getSpreadsheetNameByIdAction } = await import("./actions");

const call = (googleSheetIntegration: unknown, workspaceId: string) =>
  (getSpreadsheetNameByIdAction as unknown as (args: unknown) => Promise<unknown>)({
    ctx: { user: { id: "user1" } },
    parsedInput: { googleSheetIntegration, workspaceId, spreadsheetId: "sheet1" },
  });

describe("getSpreadsheetNameByIdAction — ENG-1921 cross-workspace integration hijack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAuthorizationUpdated.mockResolvedValue(undefined);
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue("org1");
    mocks.getSpreadsheetNameById.mockResolvedValue("My Sheet");
  });

  test("rejects an integration whose workspaceId differs from the authorized workspace", async () => {
    await expect(call({ workspaceId: "victim-ws", config: { data: [] } }, "attacker-ws")).rejects.toThrow(
      OperationNotAllowedError
    );
    expect(mocks.getSpreadsheetNameById).not.toHaveBeenCalled();
  });

  test("allows an integration for the authorized workspace", async () => {
    const result = await call({ workspaceId: "attacker-ws", config: { data: [] } }, "attacker-ws");
    expect(mocks.getSpreadsheetNameById).toHaveBeenCalled();
    expect(result).toBe("My Sheet");
  });
});
