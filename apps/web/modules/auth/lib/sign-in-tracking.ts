import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { POSTHOG_KEY } from "@/lib/constants";
import { capturePostHogEvent } from "@/lib/posthog";
import { updateUserLastLoginAt } from "@/modules/auth/lib/user";

export const captureSignIn = async ({ userId, provider }: { userId: string; provider: string }) => {
  if (!POSTHOG_KEY) {
    return;
  }

  try {
    const [membershipCount, userData] = await Promise.all([
      prisma.membership.count({ where: { userId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { lastLoginAt: true } }),
    ]);
    const isFirstLoginToday =
      userData?.lastLoginAt?.toISOString().slice(0, 10) !== new Date().toISOString().slice(0, 10);

    capturePostHogEvent(userId, "user_signed_in", {
      auth_provider: provider,
      organization_count: membershipCount,
      is_first_login_today: isFirstLoginToday,
    });
  } catch (error) {
    logger.warn({ error }, "Failed to capture PostHog sign-in event");
  }
};

export const finalizeSuccessfulSignIn = async ({
  userId,
  email,
  provider,
}: {
  userId: string;
  email: string;
  provider: string;
}) => {
  void captureSignIn({ userId, provider });
  await updateUserLastLoginAt(email);
};
