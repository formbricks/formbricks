import { describe, expect, test, vi } from "vitest";
import { AuthenticationError } from "@formbricks/types/errors";
import { TIntegrationGoogleSheets } from "@formbricks/types/integration/google-sheet";
import { GOOGLE_SHEET_INTEGRATION_INVALID_GRANT } from "@/lib/googleSheet/constants";

vi.mock("@/lib/integration/service", () => ({ createOrUpdateIntegration: vi.fn() }));

vi.mock("@/lib/constants", () => ({
  GOOGLE_SHEETS_CLIENT_ID: "client-id",
  GOOGLE_SHEETS_CLIENT_SECRET: "client-secret",
  GOOGLE_SHEETS_REDIRECT_URL: "https://example.com/callback",
  GOOGLE_SHEET_MESSAGE_LIMIT: 50000,
}));

const { getSpreadsheetNameById } = await import("@/lib/googleSheet/service");

/**
 * The shape the integration has once ENG-2078's redaction has blanked `config.key`: schema-valid,
 * because `ZGoogleCredential` types both tokens as `z.string()`, but unusable for auth.
 */
const redactedIntegration = {
  id: "integration1",
  type: "googleSheets",
  workspaceId: "ws1",
  config: {
    email: "owner@example.com",
    data: [],
    key: {
      scope: "https://www.googleapis.com/auth/spreadsheets",
      token_type: "Bearer",
      expiry_date: 0,
      access_token: "",
      refresh_token: "",
    },
  },
} as TIntegrationGoogleSheets;

// ENG-2303: a blank refresh token reached googleapis, which surfaced it as a bare "No refresh token is
// set." straight into a user-facing toast. It has to fail as the reconnect case instead, which the modal
// maps to a real message. Nothing here touches the network: the guard short-circuits before any Google
// call, which is also what keeps this test hermetic.
describe("getSpreadsheetNameById", () => {
  test("throws an invalid_grant AuthenticationError when the stored refresh token is blank", async () => {
    await expect(getSpreadsheetNameById(redactedIntegration, "sheet1")).rejects.toThrow(
      new AuthenticationError(GOOGLE_SHEET_INTEGRATION_INVALID_GRANT)
    );
  });
});
