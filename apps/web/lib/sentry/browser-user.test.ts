import { beforeEach, describe, expect, test, vi } from "vitest";
import { setBrowserSentryUser } from "@/lib/sentry/browser-user";

const mockSetUser = vi.hoisted(() => vi.fn());

vi.mock("@sentry/nextjs", () => ({
  setUser: mockSetUser,
}));

describe("setBrowserSentryUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sets only the opaque user id", () => {
    setBrowserSentryUser("user-1");

    expect(mockSetUser).toHaveBeenCalledTimes(1);
    expect(mockSetUser).toHaveBeenCalledWith({ id: "user-1" });
  });

  test("returns a cleanup that clears the user", () => {
    const cleanup = setBrowserSentryUser("user-1");
    mockSetUser.mockClear();

    cleanup();

    expect(mockSetUser).toHaveBeenCalledTimes(1);
    expect(mockSetUser).toHaveBeenCalledWith(null);
  });
});
