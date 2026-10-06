/** Gives a slot back. Idempotent: every exit path may call it, and only the first call counts. */
export type TReleaseSlot = () => void;

export type TAcquireResult =
  | { ok: true; release: TReleaseSlot }
  /** `capacity`: every slot on this process is taken. `per_key`: this caller already holds its share. */
  | { ok: false; reason: "capacity" | "per_key" };

/**
 * A counting semaphore that never queues: `tryAcquire` either takes a slot at once or reports why it
 * could not, so the caller can answer straight away instead of holding a request open.
 *
 * The count lives in this module instance, which makes it a per-process limit — on a Formbricks pod,
 * one Node process, so per pod. That is the point: it bounds the memory and event-loop time one
 * process spends on expensive requests, which a per-user rate limit cannot do when many users
 * arrive at once. It is not a cluster-wide limit and does not try to be one.
 *
 * `maxPerKey` stops one caller holding every slot — with slow uploads or long requests, one user could
 * otherwise shut every other tenant out of the route on that pod.
 */
export class ConcurrencyLimiter {
  readonly maxInFlight: number;
  readonly maxPerKey: number | undefined;
  #inFlight = 0;
  readonly #inFlightByKey = new Map<string, number>();

  constructor(maxInFlight: number, { maxPerKey }: { maxPerKey?: number } = {}) {
    if (!Number.isSafeInteger(maxInFlight) || maxInFlight <= 0) {
      throw new Error(`ConcurrencyLimiter: maxInFlight must be a positive integer, got ${maxInFlight}`);
    }
    if (maxPerKey !== undefined && (!Number.isSafeInteger(maxPerKey) || maxPerKey <= 0)) {
      throw new Error(`ConcurrencyLimiter: maxPerKey must be a positive integer, got ${maxPerKey}`);
    }

    this.maxInFlight = maxInFlight;
    this.maxPerKey = maxPerKey;
  }

  get inFlight(): number {
    return this.#inFlight;
  }

  /** Slots `key` holds right now. */
  inFlightFor(key: string): number {
    return this.#inFlightByKey.get(key) ?? 0;
  }

  /**
   * Takes a slot for `key` (the caller's identity) and returns its release function, or says why it
   * could not. Without a key only the process-wide limit applies.
   */
  tryAcquire(key?: string): TAcquireResult {
    if (this.maxPerKey !== undefined && key !== undefined && this.inFlightFor(key) >= this.maxPerKey) {
      return { ok: false, reason: "per_key" };
    }
    if (this.#inFlight >= this.maxInFlight) {
      return { ok: false, reason: "capacity" };
    }

    this.#inFlight += 1;
    if (key !== undefined) {
      this.#inFlightByKey.set(key, this.inFlightFor(key) + 1);
    }

    let released = false;
    const release = () => {
      if (released) {
        return;
      }

      released = true;
      this.#inFlight -= 1;
      if (key !== undefined) {
        const remaining = this.inFlightFor(key) - 1;
        if (remaining > 0) this.#inFlightByKey.set(key, remaining);
        else this.#inFlightByKey.delete(key);
      }
    };

    return { ok: true, release };
  }
}

/**
 * Holds `release` until the response body has been read to the end, failed, or been cancelled by
 * the client, then calls it once. A response without a body releases straight away.
 *
 * Needed because a streamed response is still running when the handler returns it: releasing on
 * return would free the slot while the work it guards — an AI call feeding the stream — carries on.
 * Next cancels the body when the client disconnects, which lands in `cancel` here.
 */
export function releaseWhenBodySettles(response: Response, release: TReleaseSlot): Response {
  if (!response.body) {
    release();
    return response;
  }

  const reader = response.body.getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          release();
          controller.close();
          return;
        }

        controller.enqueue(value);
      } catch (error) {
        release();
        controller.error(error);
      }
    },
    async cancel(reason) {
      release();
      // A source that already failed rejects its cancel; the client is gone, so there is nobody to
      // tell, and letting it reject would only surface as an unhandled rejection.
      await reader.cancel(reason).catch(() => undefined);
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
