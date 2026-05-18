import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { POSTHOG_KEY } from "@/lib/constants";
import { capturePostHogEvent } from "@/lib/posthog";
import { updateUserLastLoginAt } from "@/modules/auth/lib/user";

const getIsFirstLoginToday = (lastLoginAt: Date | null | undefined) =>
  lastLoginAt?.toISOString().slice(0, 10) !== new Date().toISOString().slice(0, 10);

export const captureSignIn = async ({
  userId,
  provider,
  previousLastLoginAt,
}: {
  userId: string;
  provider: string;
  previousLastLoginAt?: Date | null;
}) => {
  if (!POSTHOG_KEY) {
    return;
  }

  try {
    const membershipCountPromise = prisma.membership.count({ where: { userId } });
    const resolvedPreviousLastLoginAt =
      previousLastLoginAt === undefined
        ? (
            await prisma.user.findUnique({
              where: { id: userId },
              select: { lastLoginAt: true },
            })
          )?.lastLoginAt
        : previousLastLoginAt;
    const membershipCount = await membershipCountPromise;

    capturePostHogEvent(userId, "user_signed_in", {
      auth_provider: provider,
      organization_count: membershipCount,
      is_first_login_today: getIsFirstLoginToday(resolvedPreviousLastLoginAt),
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
  const previousLastLoginAt = await updateUserLastLoginAt(email);
  void captureSignIn({ userId, provider, previousLastLoginAt });
};
