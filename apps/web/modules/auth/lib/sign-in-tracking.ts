import { cookies } from "next/headers";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { POSTHOG_KEY } from "@/lib/constants";
import { capturePostHogEvent } from "@/lib/posthog";
import { ATTRIBUTION_COOKIE_NAME, getAttributionPropertiesFromCookies } from "@/modules/auth/lib/attribution";
import { updateUserLastLoginAt } from "@/modules/auth/lib/user";

const getIsFirstLoginToday = (lastLoginAt: Date | null | undefined) =>
  lastLoginAt?.toISOString().slice(0, 10) !== new Date().toISOString().slice(0, 10);

/**
 * Reads the attribution cookie and clears it, all within the current request scope.
 * Must be called while the request context is still alive (i.e. NOT from the detached
 * captureSignIn promise) so that `cookies()` cannot throw "outside a request scope" and
 * silently drop the sign-in event. Any failure degrades gracefully to no attribution.
 */
const consumeAttributionProperties = async (): Promise<Record<string, string>> => {
  try {
    const cookieStore = await cookies();
    const properties = getAttributionPropertiesFromCookies(cookieStore);
    if (Object.keys(properties).length > 0) {
      // Clear once consumed so it can't bleed onto a later (or different) user's events.
      try {
        cookieStore.delete(ATTRIBUTION_COOKIE_NAME);
      } catch {
        // Cookie mutation may not be permitted in every context; the short cookie
        // lifetime is the backstop.
      }
    }
    return properties;
  } catch {
    return {};
  }
};

export const captureSignIn = async ({
  userId,
  provider,
  previousLastLoginAt,
  attributionProperties = {},
}: {
  userId: string;
  provider: string;
  previousLastLoginAt?: Date | null;
  attributionProperties?: Record<string, string>;
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
      // Spread attribution first so trusted, server-computed props always win on a name clash.
      ...attributionProperties,
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
  // Read (and clear) the cookie here, in the request scope, before firing the
  // fire-and-forget capture — cookies() is not safe inside the detached promise.
  const attributionProperties = await consumeAttributionProperties();
  void captureSignIn({ userId, provider, previousLastLoginAt, attributionProperties });
};
