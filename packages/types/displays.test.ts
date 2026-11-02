import { describe, expect, test } from "vitest";
import { ZDisplayCreateInput } from "./displays";

/** What every SDK sends to create a display; SDKs from before creatives send nothing more. */
const body = { workspaceId: "clx0000000000000000000w1", surveyId: "clx0000000000000000000s2" };

describe("ZDisplayCreateInput", () => {
  test("accepts the body an SDK from before creatives sends", () => {
    expect(ZDisplayCreateInput.parse(body)).toStrictEqual(body);
  });

  test("keeps a well-formed creativeId for the ingest route to check", () => {
    expect(ZDisplayCreateInput.parse({ ...body, creativeId: "clx0000000000000000000c3" })).toStrictEqual({
      ...body,
      creativeId: "clx0000000000000000000c3",
    });
  });

  test.each([
    ["an id in another format", "creative_1"],
    ["an empty string", ""],
    ["a number", 42],
    ["null", null],
  ])("drops %s as creativeId, so the display is still created", (_label, creativeId) => {
    const parsed = ZDisplayCreateInput.safeParse({ ...body, creativeId });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject(body);
    expect(parsed.data?.creativeId).toBeUndefined();
  });
});
