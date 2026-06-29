import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getSessionUser } from "@/app/api/v1/management/me/lib/utils";
import { mockUser } from "@/modules/auth/lib/mock-data";
import { getSession } from "@/modules/auth/lib/session";

// getSessionUser reads the Better Auth session DAL (ENG-1054: NextAuth's getServerSession is gone).
vi.mock("@/modules/auth/lib/session", () => ({
  getSession: vi.fn(),
}));

describe("getSessionUser", () => {
  afterEach(() => {
    cleanup();
  });

  test("returns the session user when a session exists", async () => {
    vi.mocked(getSession).mockResolvedValue({ user: mockUser } as never);

    expect(await getSessionUser()).toEqual(mockUser);
    expect(getSession).toHaveBeenCalled();
  });

  test("returns undefined when there is no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    expect(await getSessionUser()).toBeUndefined();
  });
});
