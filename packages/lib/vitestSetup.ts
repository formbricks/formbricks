// mock these globally used functions
import "@testing-library/jest-dom/vitest";
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

vi.mock("react", async () => {
  const react = await vi.importActual<typeof import("react")>("react");

  return {
    ...react,
    cache: testCache,
  };
});

vi.mock("@tolgee/react", () => ({
  // Return a fake translation hook:
  useTranslate: () => {
    return {
      t: (key: string) => key,
    };
  },
}));

vi.mock("next/navigation", () => ({
  // Return a mock version of useRouter
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// mock server-only
vi.mock("server-only", () => {
  return {};
});

if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => {
    // No-op stub: doesn't need to do anything in tests.
  };
}

if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob://fake-url";
}

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
