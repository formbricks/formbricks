import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockCreateGatewayServiceTokenResponse,
  mockWithV3ApiWrapper,
  mockWrapperAuthentication,
  mockParsedInputBody,
} = vi.hoisted(() => ({
  mockCreateGatewayServiceTokenResponse: vi.fn(),
  mockWithV3ApiWrapper: vi.fn(),
  mockWrapperAuthentication: {
    current: {
      user: { id: "user_1" },
    } as { user: { id: string } } | null,
  },
  mockParsedInputBody: {
    current: {
      service: "feedbackRecords",
    } as { service: "feedbackRecords" },
  },
}));

const installWrapperMock = () => {
  mockWithV3ApiWrapper.mockImplementation(
    ({
      handler,
    }: {
      handler: (params: {
        authentication: { user: { id: string } } | null;
        parsedInput: { body: { service: "feedbackRecords" } };
      }) => Promise<Response>;
    }) =>
      async () =>
        await handler({
          authentication: mockWrapperAuthentication.current,
          parsedInput: {
            body: mockParsedInputBody.current,
          },
        } as never)
  );
};

vi.mock("@/modules/gateway-auth/lib/token", () => ({
  createGatewayServiceTokenResponse: mockCreateGatewayServiceTokenResponse,
}));

vi.mock("@/app/api/v3/lib/api-wrapper", () => ({
  withV3ApiWrapper: mockWithV3ApiWrapper,
}));

describe("POST /api/v3/gateway/token", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    installWrapperMock();
    mockWrapperAuthentication.current = {
      user: { id: "user_1" },
    };
    mockParsedInputBody.current = {
      service: "feedbackRecords",
    };
    mockCreateGatewayServiceTokenResponse.mockReturnValue(
      Response.json({
        token: "gateway-token",
        expiresAt: "2026-04-24T00:10:00.000Z",
      })
    );
  });

  test("mints a gateway token for the requested service", async () => {
    const { POST } = await import("./route");
    const response = await POST({} as never, {} as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      token: "gateway-token",
      expiresAt: "2026-04-24T00:10:00.000Z",
    });
    expect(mockCreateGatewayServiceTokenResponse).toHaveBeenCalledWith(
      { user: { id: "user_1" } },
      "feedbackRecords"
    );
  });
});
