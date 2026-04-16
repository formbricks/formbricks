import { describe, expect, test, vi } from "vitest";

const prismaMembershipCount = vi.fn();
const prismaUserFindUnique = vi.fn();
const capturePostHogEvent = vi.fn();

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
