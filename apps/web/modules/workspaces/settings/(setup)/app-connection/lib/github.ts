import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";

const LATEST_RELEASE_URL = "https://api.github.com/repos/formbricks/formbricks/releases/latest";
// Cache successful lookups for one hour so we don't hit GitHub on every navigation load.
const SUCCESS_TTL_MS = 60 * 60 * 1000;
// Cache failures (rate limit, timeout, outage) for a much shorter window so the
// version badge reappears soon after GitHub recovers instead of staying hidden for an hour.
const FAILURE_TTL_MS = 5 * 60 * 1000;

interface CachedRelease {
  tagName: string | null;
  failed: boolean;
  fetchedAt: number;
}

/**
 * Fetches the latest stable Formbricks release tag from GitHub.
 *
 * This runs entirely server-side, so it degrades gracefully instead of throwing:
 * when GitHub is rate-limited, returns an HTML error page, or is otherwise
 * unavailable, it returns `null` and the caller simply hides the version badge.
 *
 * The result is cached (see TTLs above) so we stay well under GitHub's
 * unauthenticated rate limit (~60/hr) without needing a token.
 */
export const getLatestStableFbRelease = async (): Promise<string | null> => {
  const cacheKey = createCacheKey.custom("github", "latest_release");

  try {
    const cached = await cache.get<CachedRelease>(cacheKey);
    if (cached.ok && cached.data) {
      const { tagName = null, failed = false, fetchedAt = 0 } = cached.data;
      const ttl = failed ? FAILURE_TTL_MS : SUCCESS_TTL_MS;
      if (Date.now() - fetchedAt < ttl) {
        return tagName;
      }
      // If the cache entry has expired (e.g. failure TTL elapsed), delete it
      // so withCacheNullable will fetch a fresh copy.
      await cache.del([cacheKey]);
    }
  } catch (error) {
    logger.warn({ error }, "Failed to get cached release from Redis");
  }

  const result = await cache.withCacheNullable<CachedRelease>(
    async () => {
      try {
        const res = await fetch(LATEST_RELEASE_URL, {
          headers: { Accept: "application/vnd.github+json" },
        });

        const contentType = res.headers.get("content-type") ?? "";
        if (!res.ok || !contentType.includes("application/json")) {
          logger.warn(
            { status: res.status, contentType },
            "Failed to fetch latest stable Formbricks release from GitHub"
          );
          return { tagName: null, failed: true, fetchedAt: Date.now() };
        }

        const release = await res.json();
        const tagName = typeof release?.tag_name === "string" ? release.tag_name : null;

        return { tagName, failed: false, fetchedAt: Date.now() };
      } catch (error) {
        logger.warn(error, "Failed to fetch latest stable Formbricks release from GitHub");
        return { tagName: null, failed: true, fetchedAt: Date.now() };
      }
    },
    cacheKey,
    SUCCESS_TTL_MS
  );

  return result ? result.tagName : null;
};
