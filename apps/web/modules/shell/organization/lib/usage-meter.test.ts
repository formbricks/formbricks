import { describe, expect, test } from "vitest";
import { getUsageMeter } from "./usage-meter";

describe("getUsageMeter", () => {
  test("a plan without a limit has no bar to fill", () => {
    expect(getUsageMeter(4210, null)).toEqual({ current: 4210, limit: null, ratio: 0, tone: "ok" });
  });

  test("reports the share used and turns amber from 90 percent", () => {
    expect(getUsageMeter(4210, 10000)).toMatchObject({ ratio: 0.421, tone: "ok" });
    expect(getUsageMeter(9000, 10000)).toMatchObject({ ratio: 0.9, tone: "warning" });
  });

  test("a full allowance is still within the plan, going past it is over", () => {
    expect(getUsageMeter(10000, 10000)).toMatchObject({ ratio: 1, tone: "warning" });
    expect(getUsageMeter(10001, 10000)).toMatchObject({ ratio: 1, tone: "over" });
  });

  test("a limit of zero is over as soon as anything is used", () => {
    expect(getUsageMeter(0, 0)).toMatchObject({ ratio: 0, tone: "ok" });
    expect(getUsageMeter(1, 0)).toMatchObject({ ratio: 1, tone: "over" });
  });
});
