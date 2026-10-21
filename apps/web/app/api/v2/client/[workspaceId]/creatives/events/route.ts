import { logger } from "@formbricks/logger";
import { responses } from "@/app/lib/api/response";
import { countCreativeEvents } from "@/modules/creatives/lib/client-events";

/**
 * POST /api/v2/client/{workspaceId}/creatives/events — the web SDK's Impressions and Clicks of one page
 * view (ENG-4000; body: `TCreativeEventsBody` in `@formbricks/creatives`).
 *
 * Always 204, with nothing to read: the SDK sends it as a `keepalive` beacon while the page may be
 * closing, so an error, a rate limit or a dropped event changes nothing for the visitor. The IP rate
 * limit is applied inside, not by a wrapper that would answer 429.
 */

interface Context {
  params: Promise<{ workspaceId: string }>;
}

export const OPTIONS = (): Response =>
  responses.successResponse({}, true, "public, s-maxage=3600, max-age=3600");

export const POST = async (request: Request, context: Context): Promise<Response> => {
  try {
    const { workspaceId } = await context.params;
    await countCreativeEvents(request, workspaceId);
  } catch (error) {
    // Redis is down or refuses writes (Valkey runs `noeviction`): these counts are lost, the page isn't.
    logger.warn({ error, url: request.url }, "Creative events could not be counted");
  }
  return responses.noContentResponse(true);
};
