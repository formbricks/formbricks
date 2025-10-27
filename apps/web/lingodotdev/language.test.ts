import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getUserLocale } from "@/lib/user/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getLocale } from "./language";

// Mock dependencies
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@/lib/user/service", () => ({
  getUserLocale: vi.fn(),
}));
vi.mock("@/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn(),
}));
vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: vi.fn(),
}));

describe("lingodotdev getLocale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return user locale when session exists and user has id", async () => {
    const mockSession = {
      user: {
        id: "user-123",
      },
    };
    const userLocale = "de-DE";

    vi.mocked(getServerSession).mockResolvedValue(mockSession);
    vi.mocked(getUserLocale).mockResolvedValue(userLocale);

    const result = await getLocale();

    expect(getServerSession).toHaveBeenCalledWith(authOptions);
    expect(getUserLocale).toHaveBeenCalledWith("user-123");
    expect(findMatchingLocale).not.toHaveBeenCalled();
    expect(result).toBe(userLocale);
  });

  test("should use findMatchingLocale when no session exists", async () => {
    const matchingLocale = "fr-FR";

    vi.mocked(getServerSession).mockResolvedValue(null);
    vi.mocked(findMatchingLocale).mockResolvedValue(matchingLocale);

    const result = await getLocale();

    expect(getServerSession).toHaveBeenCalledWith(authOptions);
    expect(getUserLocale).not.toHaveBeenCalled();
    expect(findMatchingLocale).toHaveBeenCalled();
    expect(result).toBe(matchingLocale);
  });

  test("should return DEFAULT_LOCALE when getUserLocale returns undefined", async () => {
    const mockSession = {
      user: {
        id: "user-123",
      },
    };

    vi.mocked(getServerSession).mockResolvedValue(mockSession);
    vi.mocked(getUserLocale).mockResolvedValue(undefined);

    const result = await getLocale();

    expect(getServerSession).toHaveBeenCalledWith(authOptions);
    expect(getUserLocale).toHaveBeenCalledWith("user-123");
    expect(result).toBe(DEFAULT_LOCALE);
  });
});
