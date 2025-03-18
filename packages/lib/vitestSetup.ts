// mock these globally used functions
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ValidationError } from "@formbricks/types/errors";

// mock next cache

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

// mock tolgee useTranslate on components

vi.mock("@tolgee/react", () => ({
  useTranslate: () => {
    return {
      t: (key: string) => key,
    };
  },
}));

// mock next/router navigation

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");

  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
      refresh: vi.fn(),
    }),
    notFound: vi.fn(),
    redirect: vi.fn(),
    useSearchParams: () => new URLSearchParams(""),
  };
});

// mock server-only
vi.mock("server-only", () => {
  return {};
});

// mock prisma client

vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");

  return {
    ...actual,
    Prisma: actual.Prisma,
    PrismaClient: class {
      $connect() {
        return Promise.resolve();
      }
      $disconnect() {
        return Promise.resolve();
      }
      $extends() {
        return this;
      }
    },
  };
});

// mock URL object

if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => {};
}

if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob://fake-url";
}

// mock crypto function used in the license check utils, every component that checks the license will use this mock
// also used in a lot of other places too
vi.mock("crypto", async () => {
  const actual = await vi.importActual<typeof import("crypto")>("crypto");

  return {
    ...actual,

    createHash: () => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue("fake-hash"),
    }),
    default: {
      ...actual,
      createHash: () => ({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue("fake-hash"),
      }),
    },
  };
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
