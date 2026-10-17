import type { TShowConditionDeviceType } from "@formbricks/types/show-conditions";

/**
 * The counting contract (ENG-4000, ADR 0005): what the web SDK sends to
 * `POST /api/v2/client/{workspaceId}/creatives/events`.
 *
 * - The SDK sends the body as `text/plain` with `keepalive` (a CORS-simple request: no preflight, and it
 *   survives the page closing), 2 s after the first event of a page or when the page is hidden,
 *   whichever comes first, and at once when a batch is full.
 * - One request carries the events of one page view. A new page, a single-page-app route change
 *   included, starts a new batch.
 * - An Impression is sent once per creative per page view on which it showed; a Click for each press
 *   that opened the creative's Destination.
 * - The server answers 204 whatever happens and counts silently: it drops the whole request from bots,
 *   over the IP rate limit or with a body that doesn't match this shape, and single events for
 *   creatives the workspace doesn't have (published and not archived).
 */

export type TCreativeEventType = "impression" | "click";

export interface TCreativeEvent {
  creativeId: string;
  type: TCreativeEventType;
}

export interface TCreativeEventsBody {
  /** Where the events happened: host and path, without query string or hash (`example.com/pricing`). */
  page: string;
  deviceType: TShowConditionDeviceType;
  /** At least one, at most `MAX_CREATIVE_EVENTS_PER_REQUEST`. */
  events: TCreativeEvent[];
}

export const MAX_CREATIVE_EVENTS_PER_REQUEST = 100;
export const MAX_COUNTED_PAGE_LENGTH = 512;

/** The page an event is counted under: host and path, cut to `MAX_COUNTED_PAGE_LENGTH`. */
export const getCountedPage = (href: string): string | null => {
  try {
    const url = new URL(href);
    if (!url.host) return null;
    return `${url.host}${url.pathname}`.slice(0, MAX_COUNTED_PAGE_LENGTH);
  } catch {
    return null;
  }
};
