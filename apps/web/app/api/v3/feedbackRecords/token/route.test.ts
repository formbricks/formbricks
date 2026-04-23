import { describe, expect, test, vi } from "vitest";

const { mockCreateFeedbackRecordsGatewayToken, mockWithV3ApiWrapper } = vi.hoisted(() => ({
  mockCreateFeedbackRecordsGatewayToken: vi.fn(),
  mockWithV3ApiWrapper: vi.fn(),
}));

vi.mock("@/lib/jwt", () => ({
  createFeedbackRecordsGatewayToken: mockCreateFeedbackRecordsGatewayToken,
}));

vi.mock("@/app/api/v3/lib/api-wrapper", () => ({
  withV3ApiWrapper: mockWithV3ApiWrapper.mockImplementation(
    ({ handler }: { handler: (params: { authentication: { user: { id: string } } }) => Promise<Response> }) =>
      async () =>
        await handler({
          authentication: {
            user: { id: "user_1" },
          },
        } as never)
  ),
}));

describe("POST /api/v3/feedbackRecords/token", () => {
  test("returns the minted gateway token payload", async () => {
    mockCreateFeedbackRecordsGatewayToken.mockReturnValue({
      token: "gateway-token",
      expiresAt: "2026-04-24T00:10:00.000Z",
    });

    const { POST } = await import("./route");
    const response = await POST({} as never, {} as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      token: "gateway-token",
      expiresAt: "2026-04-24T00:10:00.000Z",
    });
    expect(mockCreateFeedbackRecordsGatewayToken).toHaveBeenCalledWith("user_1");
  });
});
