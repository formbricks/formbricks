import { describe, expect, test } from "vitest";
import { MAX_CHART_DATA_IN_FLIGHT, takeChartDataTurn } from "./chart-data-queue";

/** A request that runs until released, recording how many ran alongside it. */
const tracker = () => {
  let running = 0;
  let peak = 0;
  const releases: (() => void)[] = [];
  const request = () =>
    new Promise<number>((resolve) => {
      running++;
      peak = Math.max(peak, running);
      releases.push(() => {
        running--;
        resolve(peak);
      });
    });
  return { request, releases, peak: () => peak };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("takeChartDataTurn", () => {
  test("runs at most the limit at once, then the rest in the order asked", async () => {
    const { request, releases, peak } = tracker();
    const order: number[] = [];
    const all = Array.from({ length: MAX_CHART_DATA_IN_FLIGHT + 3 }, (_, index) =>
      takeChartDataTurn(undefined, async () => {
        order.push(index);
        return request();
      })
    );

    await flush();
    expect(releases).toHaveLength(MAX_CHART_DATA_IN_FLIGHT);

    while (releases.length > 0) {
      releases.shift()?.();
      await flush();
    }
    await Promise.all(all);
    expect(peak()).toBe(MAX_CHART_DATA_IN_FLIGHT);
    expect(order).toEqual(Array.from({ length: MAX_CHART_DATA_IN_FLIGHT + 3 }, (_, index) => index));
  });

  test("drops a waiting request whose signal aborts, without running it or blocking the next", async () => {
    const { request, releases } = tracker();
    const busy = Array.from({ length: MAX_CHART_DATA_IN_FLIGHT }, () =>
      takeChartDataTurn(undefined, request)
    );
    const controller = new AbortController();
    let abortedRan = false;
    const aborted = takeChartDataTurn(controller.signal, async () => {
      abortedRan = true;
      return 0;
    });
    const next = takeChartDataTurn(undefined, async () => "next ran");

    controller.abort();
    await expect(aborted).rejects.toMatchObject({ name: "AbortError" });

    releases.shift()?.();
    expect(await next).toBe("next ran");
    expect(abortedRan).toBe(false);

    for (const release of releases) release();
    await Promise.all(busy);
  });

  test("frees the turn when a request fails", async () => {
    const failing = Array.from({ length: MAX_CHART_DATA_IN_FLIGHT }, () =>
      takeChartDataTurn(undefined, async () => {
        throw new Error("502");
      }).catch(() => "failed")
    );
    await Promise.all(failing);
    expect(await takeChartDataTurn(undefined, async () => "ran")).toBe("ran");
  });

  test("serves a waiting request before one that asks later", async () => {
    const { request, releases } = tracker();
    const busy = Array.from({ length: MAX_CHART_DATA_IN_FLIGHT }, () =>
      takeChartDataTurn(undefined, request)
    );
    const started: string[] = [];
    const waiter = takeChartDataTurn(undefined, async () => {
      started.push("waiter");
      return request(); // holds its turn until released
    });

    releases.shift()?.();
    // Asks in the same tick the turn is freed, before the waiter has resumed.
    const newcomer = takeChartDataTurn(undefined, async () => {
      started.push("newcomer");
    });
    await flush();
    expect(started).toEqual(["waiter"]);

    releases.shift()?.();
    await flush();
    expect(started).toEqual(["waiter", "newcomer"]);

    for (const release of releases) release();
    await Promise.all([...busy, waiter, newcomer]);
  });
});
