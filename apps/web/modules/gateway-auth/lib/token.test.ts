import { describe, expect, test, vi } from "vitest";
import { createGatewayServiceTokenResponse } from "./token";

const { mockCreateGatewayServiceToken } = vi.hoisted(() => ({
  mockCreateGatewayServiceToken: vi.fn(),
}));

vi.mock("@/lib/jwt", () => ({
  createGatewayServiceToken: mockCreateGatewayServiceToken,
}));

describe("createGatewayServiceTokenResponse", () => {
  test("returns 401 when no authenticated user is present", () => {
    const response = createGatewayServiceTokenResponse(null, "feedbackRecords");

    expect(response.status).toBe(401);
    expect(mockCreateGatewayServiceToken).not.toHaveBeenCalled();
  });

  test("returns the minted token payload for the requested service", async () => {
    mockCreateGatewayServiceToken.mockReturnValue({
      token: "gateway-token",
      expiresAt: "2026-04-24T00:10:00.000Z",
    });

    const response = createGatewayServiceTokenResponse(
      {
        user: {
          id: "user_1",
          name: "Test User",
          email: "test@example.com",
        },
        expires: "2026-04-25T00:00:00.000Z",
      },
      "feedbackRecords"
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      token: "gateway-token",
      expiresAt: "2026-04-24T00:10:00.000Z",
    });
    expect(mockCreateGatewayServiceToken).toHaveBeenCalledWith("user_1", "feedbackRecords");
  });
});
