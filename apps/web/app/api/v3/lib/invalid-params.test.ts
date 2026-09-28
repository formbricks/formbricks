import { describe, expect, test } from "vitest";
import { BoundedInvalidParams, V3_INVALID_PARAMS_MAX } from "./invalid-params";

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
    expect(report).toHaveLength(V3_INVALID_PARAMS_MAX + 1);
    expect(report[0]).toEqual({ name: "field.0", reason: "bad" });
    expect(report.at(-1)).toEqual({
      name: "body",
      reason: "10 further problems with this request were not reported; fix the ones above and retry",
    });
  });

  test("reports exactly what was pushed while under the cap", () => {
    const params = new BoundedInvalidParams();
    expect(params.empty).toBe(true);

    params.push(() => ({ name: "a", reason: "bad" }));

    expect(params.empty).toBe(false);
    expect(params.report("order", "order")).toEqual([{ name: "a", reason: "bad" }]);
  });
});
