import { describe, expect, test } from "vitest";
import { readUtmParams } from "./visit";

describe("readUtmParams", () => {
  test("reads all five UTM parameters as their response meta keys", () => {
    expect(
      readUtmParams(
        "?utm_source=newsletter&utm_medium=email&utm_campaign=oe2027&utm_term=plans&utm_content=hero&ref=x"
      )
    ).toEqual({
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "oe2027",
      utmTerm: "plans",
      utmContent: "hero",
    });
  });

  test("trims values and leaves out the empty ones", () => {
    expect(readUtmParams("utm_source=%20google%20&utm_medium=&utm_campaign=%20")).toEqual({
      utmSource: "google",
    });
  });

  test("returns no campaign, not an empty one, when no UTM parameter has a value", () => {
    expect(readUtmParams("")).toBeUndefined();
    expect(readUtmParams("?ref=nav&source=cta")).toBeUndefined();
    expect(readUtmParams("?utm_source=&utm_campaign=++")).toBeUndefined();
  });
});
