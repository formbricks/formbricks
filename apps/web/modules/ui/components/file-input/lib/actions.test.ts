import { beforeEach, describe, expect, test, vi } from "vitest";
import { convertHeicToJpegAction } from "./actions";

const mocks = vi.hoisted(() => ({ applyRateLimit: vi.fn(), convert: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: { inputSchema: () => ({ action: (handler: object) => handler }) },
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("heic-convert", () => ({ default: mocks.convert }));

const run = (convertHeicToJpegAction as unknown as (a: unknown) => Promise<unknown>).bind(null);
const ctx = { user: { id: "user-1" } };

describe("convertHeicToJpegAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.convert.mockResolvedValue(new Uint8Array([1]));
  });

  test("rate limits a HEIC conversion per user", async () => {
    await run({ ctx, parsedInput: { file: new File(["x"], "a.heic") } });
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "action:heic-convert" }),
      "user-1"
    );
    expect(mocks.convert).toHaveBeenCalled();
  });

  test("a refused rate limit stops the conversion", async () => {
    mocks.applyRateLimit.mockRejectedValueOnce(new Error("rate limited"));
    await expect(run({ ctx, parsedInput: { file: new File(["x"], "a.heic") } })).rejects.toThrow();
    expect(mocks.convert).not.toHaveBeenCalled();
  });
});
