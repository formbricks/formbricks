import {
  mockAppUrl,
  mockAttributes,
  mockEnvironmentId,
  mockUserId,
} from "@/lib/user/tests/__mocks__/update.mock";
import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { sendUpdates, sendUpdatesToBackend } from "@/lib/user/update";
import { type TUpdates } from "@/types/config";
import { type Mock, beforeEach, describe, expect, test, vi } from "vitest";
import { FormbricksAPI } from "@formbricks/api";

vi.mock("@/lib/common/config", () => ({
  Config: {
    getInstance: vi.fn(() => ({
      get: vi.fn(),
      update: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/common/logger", () => ({
  Logger: {
    getInstance: vi.fn(() => ({
      debug: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/common/utils", () => ({
  filterSurveys: vi.fn(),
  getIsDebug: vi.fn(),
}));

vi.mock("@formbricks/api", () => ({
  FormbricksAPI: vi.fn().mockImplementation(() => ({
    client: {
      user: {
        createOrUpdate: vi.fn(),
      },
    },
  })),
}));

describe("sendUpdatesToBackend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sends user updates to backend and returns updated state", async () => {
    const mockResponse = {
      ok: true,
      data: {
        state: {
          data: {
            userId: mockUserId,
            attributes: mockAttributes,
          },
        },
      },
    };

    (FormbricksAPI as Mock).mockImplementation(() => ({
      client: {
        user: {
          createOrUpdate: vi.fn().mockResolvedValue(mockResponse),
        },
      },
    }));

    const result = await sendUpdatesToBackend({
      appUrl: mockAppUrl,
      environmentId: mockEnvironmentId,
      updates: { userId: mockUserId, attributes: mockAttributes },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.state.data).toEqual({ userId: mockUserId, attributes: mockAttributes });
    }
  });

  test("returns network error if API call fails", async () => {
    const mockUpdates: TUpdates = { userId: mockUserId, attributes: mockAttributes };

    (FormbricksAPI as Mock).mockImplementation(() => ({
      client: {
        user: {
          createOrUpdate: vi.fn().mockResolvedValue({
            ok: false,
            error: { code: "network_error", message: "Request failed", status: 500 },
          }),
        },
      },
    }));

    const result = await sendUpdatesToBackend({
      appUrl: mockAppUrl,
      environmentId: mockEnvironmentId,
      updates: mockUpdates,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("network_error");
      expect(result.error.message).toBe("Error updating user with userId user_123");
    }
  });

  test("returns error if network request fails", async () => {
    const mockUpdates: TUpdates = { userId: mockUserId, attributes: { plan: "premium" } };

    (FormbricksAPI as Mock).mockImplementation(() => ({
      client: {
        user: {
          createOrUpdate: vi.fn().mockRejectedValue(new Error("Network error")),
        },
      },
    }));

    const result = await sendUpdatesToBackend({
      appUrl: mockAppUrl,
      environmentId: mockEnvironmentId,
      updates: mockUpdates,
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("network_error");
    }
  });
});

describe("sendUpdates", () => {
  beforeEach(() => {
    (Config.getInstance as Mock).mockImplementation(() => ({
      get: vi.fn().mockReturnValue({
        appUrl: mockAppUrl,
        environmentId: mockEnvironmentId,
        environment: {
          data: {
            surveys: [],
          },
        },
      }),
      update: vi.fn(),
    }));

    (Logger.getInstance as Mock).mockImplementation(() => ({
      debug: vi.fn(),
    }));
  });

  test("successfully processes updates", async () => {
    const mockResponse = {
      ok: true,
      data: {
        state: {
          data: {
            userId: mockUserId,
            attributes: mockAttributes,
          },
          expiresAt: new Date(Date.now() + 1000 * 60 * 30),
        },
      },
    };

    (FormbricksAPI as Mock).mockImplementation(() => ({
      client: {
        user: {
          createOrUpdate: vi.fn().mockResolvedValue(mockResponse),
        },
      },
    }));

    const result = await sendUpdates({ updates: { userId: mockUserId, attributes: mockAttributes } });

    expect(result.ok).toBe(true);
  });

  test("handles backend errors", async () => {
    const mockErrorResponse = {
      ok: false,
      error: {
        code: "invalid_request",
        status: 400,
        message: "Invalid request",
      },
    };

    (FormbricksAPI as Mock).mockImplementation(() => ({
      client: {
        user: {
          createOrUpdate: vi.fn().mockResolvedValue(mockErrorResponse),
        },
      },
    }));

    const result = await sendUpdates({ updates: { userId: mockUserId, attributes: mockAttributes } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_request");
    }
  });

  test("handles unexpected errors", async () => {
    (FormbricksAPI as Mock).mockImplementation(() => ({
      client: {
        user: {
          createOrUpdate: vi.fn().mockRejectedValue(new Error("Unexpected error")),
        },
      },
    }));

    const result = await sendUpdates({ updates: { userId: mockUserId, attributes: mockAttributes } });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("network_error");
      expect(result.error.status).toBe(500);
    }
  });
});
