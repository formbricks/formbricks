import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";

const LATEST_RELEASE_URL = "https://api.github.com/repos/formbricks/formbricks/releases/latest";
const FETCH_TIMEOUT_MS = 5 * 1000;
// Cache successful lookups for one hour so we don't hit GitHub on every navigation load.
const SUCCESS_TTL_MS = 60 * 60 * 1000;
// Cache failures (rate limit, timeout, outage) for a much shorter window so the
// version badge reappears soon after GitHub recovers instead of staying hidden for an hour.
const FAILURE_TTL_MS = 5 * 60 * 1000;

interface CachedRelease {
  tagName: string | null;
}

const fetchLatestRelease = async (): Promise<{ tagName: string | null; failed: boolean }> => {
  try {
    const res = await fetch(LATEST_RELEASE_URL, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "Failed to fetch latest stable Formbricks release from GitHub");
      return { tagName: null, failed: true };
    }

    const release = await res.json();
    const tagName = typeof release?.tag_name === "string" ? release.tag_name : null;

    return { tagName, failed: false };
  } catch (error) {
    logger.warn(error, "Failed to fetch latest stable Formbricks release from GitHub");
    return { tagName: null, failed: true };
  }
};

/**
 * Fetches the latest stable Formbricks release tag from GitHub.
 *
 * This runs entirely server-side, so it degrades gracefully instead of throwing:
 * when GitHub is rate-limited, unreachable, or returns an unexpected body, it
 * returns `null` and the caller simply hides the version badge.
 *
 * The result is cached in the shared Redis cache so the whole deployment stays
 * well under GitHub's unauthenticated rate limit (~60/hr) without needing a
 * token. The TTL is chosen at write time: successes are kept for an hour,
 * failures for a few minutes so the badge reappears soon after GitHub recovers.
 */
export const getLatestStableFbRelease = async (): Promise<string | null> => {
  const cacheKey = createCacheKey.custom("github", "latest_release");

  try {
    const cached = await cache.get<CachedRelease>(cacheKey);
    if (cached.ok && cached.data) {
      return cached.data.tagName;
    }
  } catch (error) {
    logger.warn({ error }, "Failed to read cached Formbricks release from Redis");
  }

  const { tagName, failed } = await fetchLatestRelease();

  try {
    await cache.set(cacheKey, { tagName } satisfies CachedRelease, failed ? FAILURE_TTL_MS : SUCCESS_TTL_MS);
  } catch (error) {
    logger.warn({ error }, "Failed to cache Formbricks release in Redis");
  }

  return tagName;
};
