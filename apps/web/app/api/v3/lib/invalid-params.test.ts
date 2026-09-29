import { describe, expect, test } from "vitest";
import { BoundedInvalidParams, V3_INVALID_PARAMS_MAX, capInvalidParams } from "./invalid-params";

describe("capInvalidParams", () => {
  const params = (count: number) =>
    Array.from({ length: count }, (_unused, index) => ({ name: `f.${index}`, reason: "bad" }));

  test("returns a list within the limit untouched", () => {
    const list = params(V3_INVALID_PARAMS_MAX);
    expect(capInvalidParams(list, "survey", "survey")).toBe(list);
  });

  test("cuts a longer list to 50 entries, the last one counting the rest", () => {
    const capped = capInvalidParams(params(70), "survey", "survey");

    expect(capped).toHaveLength(V3_INVALID_PARAMS_MAX);
    expect(capped[V3_INVALID_PARAMS_MAX - 2]).toEqual({ name: "f.48", reason: "bad" });
    expect(capped.at(-1)).toEqual({
      name: "survey",
      reason: "21 further problems with this survey were not reported; fix the ones above and retry",
    });
  });
});

describe("BoundedInvalidParams", () => {
  test("keeps the first entries, counts the rest without building them, and says how many", () => {
    const params = new BoundedInvalidParams();
    let built = 0;

    for (let index = 0; index < V3_INVALID_PARAMS_MAX + 10; index += 1) {
      params.push(() => {
        built += 1;
        return { name: `field.${index}`, reason: "bad" };
      });
    }

    const report = params.report("body", "request");

    expect(built).toBe(V3_INVALID_PARAMS_MAX);
    // The limit is the whole reply: 49 details and the summary make 50, never 51.
    expect(report).toHaveLength(V3_INVALID_PARAMS_MAX);
    expect(report[0]).toEqual({ name: "field.0", reason: "bad" });
    expect(report.at(-1)).toEqual({
      name: "body",
      reason: "11 further problems with this request were not reported; fix the ones above and retry",
    });
  });

  test("reports all 50 when exactly 50 were pushed", () => {
    const params = new BoundedInvalidParams();
    for (let index = 0; index < V3_INVALID_PARAMS_MAX; index += 1) {
      params.push(() => ({ name: `field.${index}`, reason: "bad" }));
    }

    const report = params.report("body", "request");

    expect(report).toHaveLength(V3_INVALID_PARAMS_MAX);
    expect(report.at(-1)).toEqual({ name: "field.49", reason: "bad" });
  });

  test("reports exactly what was pushed while under the cap", () => {
    const params = new BoundedInvalidParams();
    expect(params.empty).toBe(true);

    params.push(() => ({ name: "a", reason: "bad" }));

    expect(params.empty).toBe(false);
    expect(params.report("order", "order")).toEqual([{ name: "a", reason: "bad" }]);
  });
});
