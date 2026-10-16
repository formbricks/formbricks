import {
  MAX_CREATIVE_EVENTS_PER_REQUEST,
  type TCreativeEvent,
  type TCreativeEventsBody,
  getCountedPage,
} from "@formbricks/creatives";
import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { getDeviceInfo } from "@/lib/visit/device";

/**
 * Counting creatives (ENG-4000, ADR 0005): the Impressions and Clicks of a page view travel together in
 * one request (`TCreativeEventsBody`), sent 2 s after the first of them or when the page is hidden. The
 * server answers 204 whatever happens, so nothing here waits for, reads or retries an answer.
 */

/** How long a page's first event waits for the rest before they are sent. */
const SEND_DELAY_MS = 2_000;

let batch: { page: string; events: TCreativeEvent[] } | null = null;
let sendTimer: ReturnType<typeof setTimeout> | null = null;
let isListening = false;

/** The page view the counted Impressions belong to, and the creatives counted on it. */
let impressionsPage: string | null = null;
const countedImpressions = new Set<string>();

const sendBatch = (): void => {
  if (sendTimer !== null) clearTimeout(sendTimer);
  sendTimer = null;
  if (!batch) return;

  const { page, events } = batch;
  batch = null;
  try {
    const { appUrl, workspaceId } = Config.getInstance().get();
    const body: TCreativeEventsBody = { page, deviceType: getDeviceInfo().deviceType, events };
    // `text/plain` keeps it a CORS-simple request (no preflight); `keepalive` lets it outlive the page.
    fetch(`${appUrl}/api/v2/client/${workspaceId}/creatives/events`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
  } catch (error) {
    Logger.getInstance().debug(`Could not send creative events: ${String(error)}`);
  }
};

const sendWhenHidden = (): void => {
  if (document.visibilityState === "hidden") sendBatch();
};

const listenForPageHide = (): void => {
  if (isListening) return;
  window.addEventListener("pagehide", sendBatch);
  document.addEventListener("visibilitychange", sendWhenHidden);
  isListening = true;
};

const queueEvent = (event: TCreativeEvent, page: string): void => {
  // A batch is one page view's: a route change sends the last page's events first.
  if (batch && batch.page !== page) sendBatch();
  batch ??= { page, events: [] };
  batch.events.push(event);
  listenForPageHide();

  if (batch.events.length >= MAX_CREATIVE_EVENTS_PER_REQUEST) sendBatch();
  else sendTimer ??= setTimeout(sendBatch, SEND_DELAY_MS);
};

/**
 * One Impression for each creative on the page that hasn't had one on this page view. A page view ends
 * when the page (host + path) changes, so a single-page-app route change starts a new one.
 */
export const countImpressions = (creativeIds: Iterable<string>): void => {
  const page = getCountedPage(window.location.href);
  if (!page) return;
  if (page !== impressionsPage) {
    impressionsPage = page;
    countedImpressions.clear();
  }

  for (const creativeId of creativeIds) {
    if (countedImpressions.has(creativeId)) continue;
    countedImpressions.add(creativeId);
    queueEvent({ creativeId, type: "impression" }, page);
  }
};

/** A press that opened the creative's Destination. */
export const countClick = (creativeId: string): void => {
  const page = getCountedPage(window.location.href);
  if (page) queueEvent({ creativeId, type: "click" }, page);
};

/** Sends what is waiting and stops listening, for when the SDK takes its creatives off the page. */
export const stopCountingCreatives = (): void => {
  sendBatch();
  if (isListening) {
    window.removeEventListener("pagehide", sendBatch);
    document.removeEventListener("visibilitychange", sendWhenHidden);
    isListening = false;
  }
  impressionsPage = null;
  countedImpressions.clear();
};
