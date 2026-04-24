import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockCreateFeedbackRecordsGatewayToken, mockWithV3ApiWrapper, mockWrapperAuthentication } =
  vi.hoisted(() => ({
    mockCreateFeedbackRecordsGatewayToken: vi.fn(),
    mockWithV3ApiWrapper: vi.fn(),
    mockWrapperAuthentication: {
      current: {
        user: { id: "user_1" },
      } as { user: { id: string } } | null,
    },
  }));

const installWrapperMock = () => {
  mockWithV3ApiWrapper.mockImplementation(
    ({
      handler,
    }: {
      handler: (params: { authentication: { user: { id: string } } | null }) => Promise<Response>;
    }) =>
      async () =>
        await handler({
          authentication: mockWrapperAuthentication.current,
        } as never)
  );
};

vi.mock("@/lib/jwt", () => ({
  createFeedbackRecordsGatewayToken: mockCreateFeedbackRecordsGatewayToken,
}));

vi.mock("@/app/api/v3/lib/api-wrapper", () => ({
  withV3ApiWrapper: mockWithV3ApiWrapper,
}));

describe("POST /api/v3/feedbackRecords/token", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    installWrapperMock();
    mockWrapperAuthentication.current = {
      user: { id: "user_1" },
    };
  });

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

  test("returns 401 when the session authentication payload is unexpectedly missing", async () => {
    mockWrapperAuthentication.current = null;

    const { POST } = await import("./route");
    const response = await POST({} as never, {} as never);

    expect(response.status).toBe(401);
    expect(mockCreateFeedbackRecordsGatewayToken).not.toHaveBeenCalled();
  });
});
