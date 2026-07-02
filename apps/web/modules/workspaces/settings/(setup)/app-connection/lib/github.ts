import { logger } from "@formbricks/logger";

const LATEST_RELEASE_URL = "https://api.github.com/repos/formbricks/formbricks/releases/latest";
// Cache successful lookups for one hour so we don't hit GitHub on every navigation load.
const SUCCESS_TTL_MS = 60 * 60 * 1000;
// Cache failures (rate limit, timeout, outage) for a much shorter window so the
// version badge reappears soon after GitHub recovers instead of staying hidden for an hour.
const FAILURE_TTL_MS = 5 * 60 * 1000;

interface CachedRelease {
  tagName: string | null;
  fetchedAt: number;
}

let cachedRelease: CachedRelease | null = null;

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
  if (cachedRelease) {
    const ttl = cachedRelease.tagName ? SUCCESS_TTL_MS : FAILURE_TTL_MS;
    if (Date.now() - cachedRelease.fetchedAt < ttl) {
      return cachedRelease.tagName;
    }
  }

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
      cachedRelease = { tagName: null, fetchedAt: Date.now() };
      return null;
    }

    const release = await res.json();
    const tagName = typeof release?.tag_name === "string" ? release.tag_name : null;

    cachedRelease = { tagName, fetchedAt: Date.now() };
    return tagName;
  } catch (error) {
    logger.warn(error, "Failed to fetch latest stable Formbricks release from GitHub");
    cachedRelease = { tagName: null, fetchedAt: Date.now() };
    return null;
  }
};
