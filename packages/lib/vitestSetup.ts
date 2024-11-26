// mock these globally used functions
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ValidationError } from "@formbricks/types/errors";

vi.mock("next/cache", () => ({
  __esModule: true,
  unstable_cache: (fn: (params: unknown[]) => {}) => {
    return async (params: unknown[]) => fn(params);
  },
  revalidateTag: vi.fn(),
}));

// mock react cache
const testCache = <T extends Function>(func: T) => func;

vi.mock("react", () => {
  const originalModule = vi.importActual("react");
  return {
    ...originalModule,
    cache: testCache,
  };
});

// mock server-only
vi.mock("server-only", () => {
  return {};
});

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

export const testInputValidation = async (service: Function, ...args: any[]): Promise<void> => {
  it("it should throw a ValidationError if the inputs are invalid", async () => {
    await expect(service(...args)).rejects.toThrow(ValidationError);
  });
};
