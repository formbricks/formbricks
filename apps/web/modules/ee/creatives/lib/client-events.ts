import "server-only";
import { isBot } from "ua-parser-js/bot-detection";
import { z } from "zod";
import { createCacheKey } from "@formbricks/cache";
import {
  MAX_COUNTED_PAGE_LENGTH,
  MAX_CREATIVE_EVENTS_PER_REQUEST,
  type TCreativeEventsBody,
} from "@formbricks/creatives";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { SHOW_CONDITION_DEVICE_TYPES } from "@formbricks/types/show-conditions";
import { parseJsonBodyWithLimit } from "@/app/lib/api/request-body";
import { cache } from "@/lib/cache";
import { findWorkspaceByIdOrLegacyEnvId } from "@/lib/utils/resolve-client-id";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { type TCreativeEventCounts, incrementCreativeCounters } from "./counters";

/**
 * The client events endpoint's work (ENG-4000): `POST /api/v2/client/{workspaceId}/creatives/events`
 * from the web SDK, in the shape of `TCreativeEventsBody` (`@formbricks/creatives`). The endpoint
 * answers 204 whatever happens here, so a visitor's page never learns, waits on or retries anything.
 */

/** A full batch is about 6 KB; anything far beyond it isn't from the SDK. */
const MAX_BODY_BYTES = 16 * 1024;
/** How long the workspace's countable creatives are cached: as long as the SDK's own workspace state. */
const COUNTABLE_CREATIVES_TTL_MS = 60 * 1000;
/** Far above what a workspace publishes; the newest ones are kept. */
const MAX_COUNTABLE_CREATIVES = 1000;

/** A page is a host (port and IPv6 brackets allowed) followed by a path, so never `(other)`. */
const COUNTED_PAGE_PATTERN = /^[a-zA-Z0-9.:[\]-]+\//;

export const ZCreativeEventsBody = z.object({
  page: z.string().max(MAX_COUNTED_PAGE_LENGTH).regex(COUNTED_PAGE_PATTERN),
  deviceType: z.enum(SHOW_CONDITION_DEVICE_TYPES),
  events: z
    .array(z.object({ creativeId: ZId, type: z.enum(["impression", "click"]) }))
    .min(1)
    .max(MAX_CREATIVE_EVENTS_PER_REQUEST),
}) satisfies z.ZodType<TCreativeEventsBody>;

/**
 * The creatives an events request may count for: neither a Draft nor archived, in the workspace the SDK
 * names (by workspace id or, for SDKs set up with one, legacy environment id). The stored status decides,
 * not `publishedAt`: a restored creative keeps the date it was first published but is a Draft again, and
 * any status but Draft was published. Cached like the SDK's workspace state (no write invalidates it), so
 * counting costs no database query per page view and follows a publish, restore or archive within the TTL.
 */
const getCountableCreativeIds = (workspaceIdParam: string): Promise<string[]> =>
  cache.withCache(
    async () => {
      const workspace = await findWorkspaceByIdOrLegacyEnvId(workspaceIdParam);
      if (!workspace) return [];
      const creatives = await prisma.creative.findMany({
        where: { workspaceId: workspace.id, archivedAt: null, status: { not: "draft" } },
        select: { id: true },
        orderBy: { updatedAt: "desc" },
        take: MAX_COUNTABLE_CREATIVES,
      });
      return creatives.map(({ id }) => id);
    },
    createCacheKey.workspace.creativeIds(workspaceIdParam),
    COUNTABLE_CREATIVES_TTL_MS
  );

/**
 * Per creative: one Impression at most, since a request carries one page view, and every Click. Events
 * for creatives not in `countable` are dropped.
 */
const toCreativeEventCounts = (
  body: TCreativeEventsBody,
  countable: ReadonlySet<string>
): TCreativeEventCounts => {
  const byCreative = new Map<string, { creativeId: string; impressions: number; clicks: number }>();
  for (const { creativeId, type } of body.events) {
    if (!countable.has(creativeId)) continue;
    const counts = byCreative.get(creativeId) ?? { creativeId, impressions: 0, clicks: 0 };
    if (type === "impression") counts.impressions = 1;
    else counts.clicks += 1;
    byCreative.set(creativeId, counts);
  }
  return { page: body.page, deviceType: body.deviceType, creatives: [...byCreative.values()] };
};

const parseBody = async (request: Request): Promise<TCreativeEventsBody | null> => {
  try {
    const parsed = ZCreativeEventsBody.safeParse(await parseJsonBodyWithLimit(request, MAX_BODY_BYTES));
    return parsed.success ? parsed.data : null;
  } catch {
    // Malformed JSON or an oversized body.
    return null;
  }
};

/**
 * Counts what it can and drops the rest silently: bots and clients without a user agent, requests over
 * the IP rate limit, bodies that don't match, unknown workspaces and creatives. Throws only when Redis
 * fails or refuses the write; the endpoint logs that and still answers 204.
 */
export const countCreativeEvents = async (request: Request, workspaceIdParam: string): Promise<void> => {
  const userAgent = request.headers.get("user-agent");
  if (!userAgent || isBot(userAgent)) return;
  if (!ZId.safeParse(workspaceIdParam).success) return;

  try {
    await applyIPRateLimit(rateLimitConfigs.api.clientCreativeEvents);
  } catch (error) {
    if (error instanceof TooManyRequestsError) return;
    throw error;
  }

  const body = await parseBody(request);
  if (!body) return;

  const countable = new Set(await getCountableCreativeIds(workspaceIdParam));
  const counts = toCreativeEventCounts(body, countable);
  if (counts.creatives.length === 0) return;

  await incrementCreativeCounters(counts);
};
