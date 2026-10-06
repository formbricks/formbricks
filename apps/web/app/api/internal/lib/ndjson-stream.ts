/**
 * NDJSON streaming for internal routes that report progress while a long call runs (Create with AI, the
 * Qualtrics import). The browser reads it with `NdjsonParser`.
 */
import { logger } from "@formbricks/logger";
import { loggableError } from "./loggable-error";

export const NDJSON_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";

const encoder = new TextEncoder();

/**
 * NDJSON framing: one JSON object, one trailing newline, nothing else. Safe for any payload because
 * `JSON.stringify` escapes newlines inside strings — the single assumption this framing rests on.
 */
export function encodeNdjsonLine(event: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

export interface TNdjsonStreamOptions<TEvent> {
  /**
   * Writes the stream's events. Every guard that can answer with a problem response must have run
   * before this is called: once the body has opened, the status code is spent.
   */
  produce: (emit: (event: TEvent) => void) => Promise<void>;
  /** Turns a failure `produce` let escape into a final event, or null to end the stream quietly. */
  onError: (error: unknown) => TEvent | null;
  /** The client went away. Stop the work that feeds the stream, so it stops costing anything. */
  onCancel: () => void;
  /**
   * Runs once, after `produce` has settled and the stream has closed, however it ended. A throw here is
   * logged and goes no further: the client already has every event.
   */
  onSettled?: () => void;
  /**
   * Re-sends `event()` whenever nothing was written for `intervalMs`. Proxies drop a response that
   * goes quiet for too long (nginx's default read timeout is 60 s), so a stream that waits on one
   * long call needs this; one that writes as it goes does not.
   */
  heartbeat?: { intervalMs: number; event: () => TEvent };
}

/**
 * A 200 NDJSON response whose body is written by `produce`.
 *
 * Owns what every such stream needs and is easy to get wrong:
 * - nothing is written after the stream closed or the client cancelled — `enqueue` would throw;
 * - a failure becomes a last in-band event and a clean close, never `controller.error()`, which
 *   truncates the response and leaves the client with a bare network error;
 * - headers that stop intermediaries from buffering or transforming the body.
 */
export function createNdjsonResponse<TEvent>({
  produce,
  onError,
  onCancel,
  onSettled,
  heartbeat,
}: TNdjsonStreamOptions<TEvent>): Response {
  if (heartbeat && (!Number.isFinite(heartbeat.intervalMs) || heartbeat.intervalMs <= 0)) {
    throw new Error(
      `createNdjsonResponse: heartbeat.intervalMs must be positive, got ${heartbeat.intervalMs}`
    );
  }

  let closed = false;
  let heartbeatTimer: ReturnType<typeof setTimeout> | undefined;

  const stopHeartbeat = () => {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = undefined;
  };

  const settle = () => {
    try {
      onSettled?.();
    } catch (error) {
      // No message: the hooks log what the stream carried, so one could repeat it.
      logger.error(loggableError(error), "NDJSON stream settle hook failed");
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Rescheduled on every write, so the heartbeat fires exactly `intervalMs` after the last event
      // rather than on a fixed beat that could leave up to twice that between writes.
      const scheduleHeartbeat = () => {
        if (!heartbeat || closed) return;
        stopHeartbeat();
        heartbeatTimer = setTimeout(() => emit(heartbeat.event()), heartbeat.intervalMs);
      };

      const emit = (event: TEvent) => {
        if (closed) return;
        controller.enqueue(encodeNdjsonLine(event));
        scheduleHeartbeat();
      };

      scheduleHeartbeat();

      try {
        await produce(emit);
      } catch (error) {
        const finalEvent = onError(error);
        if (finalEvent) emit(finalEvent);
      } finally {
        stopHeartbeat();
        try {
          // close() throws on a stream the consumer already cancelled, and there is nobody left to tell.
          if (!closed) {
            closed = true;
            controller.close();
          }
        } finally {
          // After the close, so a hook that throws cannot turn a finished stream into a truncated one —
          // and in a `finally`, so the hook's cleanup runs even if closing failed.
          settle();
        }
      }
    },
    cancel() {
      // Next aborts its pipeTo on disconnect, which lands here — sometimes before `produce` notices.
      // Mark the stream closed first so no in-flight write enqueues into it.
      closed = true;
      stopHeartbeat();
      onCancel();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": NDJSON_CONTENT_TYPE,
      // no-transform is the RFC 9111 signal that forbids an intermediary coalescing or re-encoding the
      // body; X-Accel-Buffering is for self-hosters fronting Formbricks with nginx-ingress, where
      // proxy_buffering is on by default and would hold the whole response.
      "Cache-Control": "no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
