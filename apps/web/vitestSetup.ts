// mock these globally used functions
import "@testing-library/jest-dom/vitest";
import ResizeObserver from "resize-observer-polyfill";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ValidationError } from "@formbricks/types/errors";

// mock next-auth EARLY to prevent SessionProvider errors
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
      },
    },
    status: "authenticated",
  }),
  signOut: vi.fn().mockResolvedValue(undefined),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// mock our useSignOut hook directly to avoid next-auth issues in tests
vi.mock("@/modules/auth/hooks/use-sign-out", () => ({
  useSignOut: () => ({
    signOut: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Make ResizeObserver available globally (Vitest/Jest environment)
// This is used by radix-ui
if (!global.ResizeObserver) {
  global.ResizeObserver = ResizeObserver;
}

// mock react toast

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  success: vi.fn(),
  error: vi.fn(),
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

vi.mock("@tolgee/react", async () => {
  const actual = await vi.importActual<typeof import("@tolgee/react")>("@tolgee/react");

  return {
    ...actual,
    useTranslate: () => ({
      t: (key: string) => key,
    }),
    T: ({ keyName }: { keyName: string }) => keyName, // Simple functional mock
  };
});

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
    useSearchParams: vi.fn(),
    usePathname: vi.fn(),
  };
});

// mock server-only
vi.mock("server-only", () => {
  return {};
});

// mock server actions that might be called in tests
vi.mock("@/modules/auth/actions/sign-out", () => ({
  logSignOutAction: vi.fn().mockResolvedValue(undefined),
}));

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

// mock next/headers to prevent audit log system from failing
vi.mock("next/headers", () => ({
  headers: () => ({
    get: () => null,
    has: () => false,
    keys: () => [],
    values: () => [],
    entries: () => [],
    forEach: () => {},
  }),
  cookies: () => ({
    get: () => null,
    has: () => false,
    getAll: () => [],
    set: () => {},
    delete: () => {},
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

export const testInputValidation = async (service: Function, ...args: any[]): Promise<void> => {
  test("throws a ValidationError if the inputs are invalid", async () => {
    await expect(service(...args)).rejects.toThrow(ValidationError);
  });
};
