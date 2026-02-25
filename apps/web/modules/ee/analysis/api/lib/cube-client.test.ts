import { beforeEach, describe, expect, test, vi } from "vitest";

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
    const resultSet = { tablePivot: mockTablePivot };
    mockLoad.mockResolvedValue(resultSet);
    mockTablePivot.mockReturnValue([{ id: "1", count: 42 }]);
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
});
