import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockLoad = vi.fn();
const mockTablePivot = vi.fn();

vi.mock("@cubejs-client/core", () => ({
  default: vi.fn(() => ({
    load: mockLoad,
  })),
}));

describe("executeQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.doUnmock("@/lib/env");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/formbricks?schema=public");
    vi.stubEnv("ENCRYPTION_KEY", "12345678901234567890123456789012");
    vi.stubEnv("HUB_API_URL", "https://hub.formbricks.local");
    vi.stubEnv("CUBEJS_API_URL", "https://cube.example.com");
    vi.stubEnv("CUBEJS_API_SECRET", "cube-secret");
    const resultSet = { tablePivot: mockTablePivot };
    mockLoad.mockResolvedValue(resultSet);
    mockTablePivot.mockReturnValue([{ id: "1", count: 42 }]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("loads query and returns tablePivot result", async () => {
    const { executeQuery } = await import("./cube-client");
    const query = { measures: ["FeedbackRecords.count"] };
    const result = await executeQuery(query);

    expect(mockLoad).toHaveBeenCalledWith(query);
    expect(mockTablePivot).toHaveBeenCalled();
    expect(result).toEqual([{ id: "1", count: 42 }]);
  });

  test("preserves API URL when it already contains /cubejs-api/v1", async () => {
    const fullUrl = "https://cube.example.com/cubejs-api/v1";
    vi.stubEnv("CUBEJS_API_URL", fullUrl);
    const { executeQuery } = await import("./cube-client");

    await executeQuery({ measures: ["FeedbackRecords.count"] });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cubejs = ((await vi.importMock("@cubejs-client/core")) as any).default;
    expect(cubejs).toHaveBeenCalledWith(expect.any(String), { apiUrl: fullUrl });
    vi.unstubAllEnvs();
  });

  test("throws a configuration error when Cube env is missing", async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.doMock("@/lib/env", () => ({
      env: {
        CUBEJS_API_URL: undefined,
        CUBEJS_API_SECRET: undefined,
      },
    }));
    const { CUBE_CONFIGURATION_ERROR_MESSAGE } = await import("./cube-config");
    const { executeQuery } = await import("./cube-client");

    await expect(executeQuery({ measures: ["FeedbackRecords.count"] })).rejects.toThrow(
      CUBE_CONFIGURATION_ERROR_MESSAGE
    );
  });

  test("wraps Cube runtime failures in a configuration error with details", async () => {
    mockLoad.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    const { executeQuery } = await import("./cube-client");

    await expect(executeQuery({ measures: ["FeedbackRecords.count"] })).rejects.toThrow(
      /Cube query failed\..*connect ECONNREFUSED/
    );
  });
});
