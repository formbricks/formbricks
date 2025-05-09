import { verifyInviteToken } from "@/lib/jwt";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/preact";
import { getServerSession } from "next-auth";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getInvite } from "./lib/invite";
import { InvitePage } from "./page";

// Mock Next.js headers to avoid `headers()` request scope error
vi.mock("next/headers", () => ({
  headers: () => ({
    get: () => "en",
  }),
}));

// Include AVAILABLE_LOCALES for locale matching
vi.mock("@/lib/constants", () => ({
  AVAILABLE_LOCALES: ["en"],
  WEBAPP_URL: "http://localhost:3000",
  ENCRYPTION_KEY: "test-encryption-key-32-chars-long!!",
  IS_FORMBRICKS_CLOUD: false,
  IS_PRODUCTION: false,
  ENTERPRISE_LICENSE_KEY: undefined,
  FB_LOGO_URL: "https://formbricks.com/logo.png",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));

vi.mock("./lib/invite", () => ({
  getInvite: vi.fn(),
}));

vi.mock("@/lib/jwt", () => ({
  verifyInviteToken: vi.fn(),
}));

vi.mock("@tolgee/react", async () => {
  const actual = await vi.importActual<typeof import("@tolgee/react")>("@tolgee/react");
  return {
    ...actual,
    useTranslate: () => ({
      t: (key: string) => key,
    }),
    T: ({ keyName }: { keyName: string }) => keyName,
  };
});

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/modules/ee/lib/ee", () => ({
  ee: {
    sso: {
      getSSOConfig: vi.fn().mockResolvedValue(null),
    },
  },
}));

describe("InvitePage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("should show invite not found when invite doesn't exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    vi.mocked(verifyInviteToken).mockReturnValue({ inviteId: "123", email: "test@example.com" });
    vi.mocked(getInvite).mockResolvedValue(null);

    const result = await InvitePage({ searchParams: Promise.resolve({ token: "test-token" }) });

    expect(result.props.headline).toContain("auth.invite.invite_not_found");
    expect(result.props.description).toContain("auth.invite.invite_not_found_description");
  });
});
