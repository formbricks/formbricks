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

// Mock useIsMobile hook that depends on window.matchMedia
vi.mock("@/modules/ui/hooks/use-mobile", () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
}));

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

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  ENCRYPTION_KEY: "mock-encryption-key",
  ENTERPRISE_LICENSE_KEY: "mock-enterprise-license-key",
  GITHUB_ID: "mock-github-id",
  GITHUB_SECRET: "test-githubID",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  AZUREAD_CLIENT_ID: "test-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "test-azure",
  AZUREAD_TENANT_ID: "test-azuread-tenant-id",
  OIDC_DISPLAY_NAME: "test-oidc-display-name",
  OIDC_CLIENT_ID: "test-oidc-client-id",
  OIDC_ISSUER: "test-oidc-issuer",
  OIDC_CLIENT_SECRET: "test-oidc-client-secret",
  OIDC_SIGNING_ALGORITHM: "test-oidc-signing-algorithm",
  WEBAPP_URL: "test-webapp-url",
  IS_PRODUCTION: false,
  SENTRY_DSN: "mock-sentry-dsn",
  SENTRY_RELEASE: "mock-sentry-release",
  SENTRY_ENVIRONMENT: "mock-sentry-environment",
  SESSION_MAX_AGE: 1000,
  MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT: 100,
  MAX_OTHER_OPTION_LENGTH: 250,
  AVAILABLE_LOCALES: [
    "en-US",
    "de-DE",
    "pt-BR",
    "fr-FR",
    "nl-NL",
    "zh-Hant-TW",
    "pt-PT",
    "ro-RO",
    "ja-JP",
    "zh-Hans-CN",
    "es-ES",
    "sv-SE",
  ],
  DEFAULT_LOCALE: "en-US",
  BREVO_API_KEY: "mock-brevo-api-key",
  ITEMS_PER_PAGE: 30,
  PROJECT_FEATURE_KEYS: {
    FREE: "free",
  },
  FB_LOGO_URL: "mock-fb-logo-url",
  NOTION_RICH_TEXT_LIMIT: 1000,
  BILLING_LIMITS: {
    FREE: {
      PROJECTS: 3,
      RESPONSES: 1500,
      MIU: 2000,
    },
  },
  SMTP_HOST: "mock-smtp-host",
  SMTP_PORT: "587",
  SMTP_SECURE_ENABLED: false,
  SMTP_USER: "mock-smtp-user",
  SMTP_PASSWORD: "mock-smtp-password", //NOSONAR ignore rule for test setup
  SMTP_AUTHENTICATED: true,
  SMTP_REJECT_UNAUTHORIZED_TLS: true,
  MAIL_FROM: "mock@mail.com",
  MAIL_FROM_NAME: "Mock Mail",
  RATE_LIMITING_DISABLED: false,
  CONTROL_HASH: "$2b$12$fzHf9le13Ss9UJ04xzmsjODXpFJxz6vsnupoepF5FiqDECkX2BH5q",
}));
