import { describe, expect, test, vi } from "vitest";

const prismaMembershipCount = vi.fn();
const prismaUserFindUnique = vi.fn();
const capturePostHogEvent = vi.fn();
const updateUserLastLoginAt = vi.fn();

vi.mock("@formbricks/database", () => ({
  prisma: {
    membership: {
      count: prismaMembershipCount,
    },
    user: {
      findUnique: prismaUserFindUnique,
    },
  },
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    POSTHOG_KEY: undefined,
  };
});

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent,
}));

vi.mock("@/modules/auth/lib/user", () => ({
  updateUserLastLoginAt,
}));

describe("captureSignIn", () => {
  test("returns early when PostHog is disabled", async () => {
    const { captureSignIn } = await import("./sign-in-tracking");

    await captureSignIn({
      userId: "user_1",
      provider: "google",
    });

    expect(prismaMembershipCount).not.toHaveBeenCalled();
    expect(prismaUserFindUnique).not.toHaveBeenCalled();
    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });
});

describe("finalizeSuccessfulSignIn", () => {
  test("uses the previous lastLoginAt returned by the update path to avoid a second user lookup", async () => {
    vi.resetModules();

    const membershipCount = vi.fn().mockResolvedValue(3);
    const userFindUnique = vi.fn();
    const postHogCapture = vi.fn();
    const updateLastLoginAt = vi.fn().mockResolvedValue(new Date());

    vi.doMock("@formbricks/database", () => ({
      prisma: {
        membership: {
          count: membershipCount,
        },
        user: {
          findUnique: userFindUnique,
        },
      },
    }));
    vi.doMock("@/lib/constants", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/constants")>();
      return {
        ...actual,
        POSTHOG_KEY: "phc_test_key",
      };
    });
    vi.doMock("@/lib/posthog", () => ({
      capturePostHogEvent: postHogCapture,
    }));
    vi.doMock("@/modules/auth/lib/user", () => ({
      updateUserLastLoginAt: updateLastLoginAt,
    }));

    const { finalizeSuccessfulSignIn } = await import("./sign-in-tracking");
    await finalizeSuccessfulSignIn({
      userId: "user_1",
      email: "john.doe@example.com",
      provider: "google",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(updateLastLoginAt).toHaveBeenCalledWith("john.doe@example.com");
    expect(membershipCount).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(postHogCapture).toHaveBeenCalledWith("user_1", "user_signed_in", {
      auth_provider: "google",
      organization_count: 3,
      is_first_login_today: false,
    });
  });
});
