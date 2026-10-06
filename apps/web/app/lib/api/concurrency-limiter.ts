/** Gives a slot back. Idempotent: every exit path may call it, and only the first call counts. */
export type TReleaseSlot = () => void;

/**
 * A counting semaphore that never queues: `tryAcquire` either takes a slot at once or reports that
 * none is free, so the caller can answer 503 instead of holding a request open.
 *
 * The count lives in this module instance, which makes it a per-process limit — on a Formbricks pod,
 * one Node process, so per pod. That is the point: it bounds the memory and event-loop time one
 * process spends on expensive requests, which a per-user rate limit cannot do when many users
 * arrive at once. It is not a cluster-wide limit and does not try to be one.
 */
export class ConcurrencyLimiter {
  readonly maxInFlight: number;
  #inFlight = 0;

  constructor(maxInFlight: number) {
    if (!Number.isSafeInteger(maxInFlight) || maxInFlight <= 0) {
      throw new Error(`ConcurrencyLimiter: maxInFlight must be a positive integer, got ${maxInFlight}`);
    }

    this.maxInFlight = maxInFlight;
  }

  get inFlight(): number {
    return this.#inFlight;
  }

  /** Takes a slot and returns its release function, or returns null when every slot is taken. */
  tryAcquire(): TReleaseSlot | null {
    if (this.#inFlight >= this.maxInFlight) {
      return null;
    }

    this.#inFlight += 1;
    let released = false;

    return () => {
      if (released) {
        return;
      }

      released = true;
      this.#inFlight -= 1;
    };
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
