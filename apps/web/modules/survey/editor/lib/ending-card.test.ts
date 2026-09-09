import { describe, expect, test } from "vitest";
import { TSurveyEnding } from "@formbricks/types/surveys/types";
import { getEndingCardTypeChangePatch } from "./ending-card";

const redirectCard: TSurveyEnding = {
  id: "ending1",
  type: "redirectToUrl",
  url: "https://example.com",
  label: "Go",
};

const endScreenCard: TSurveyEnding = {
  id: "ending1",
  type: "endScreen",
  headline: { default: "Thanks!" },
};

describe("getEndingCardTypeChangePatch", () => {
  test("seeds an empty headline when a persisted redirect card switches back to endScreen", () => {
    const patch = getEndingCardTypeChangePatch(redirectCard, "endScreen", ["default"]);

    expect(patch).toEqual({ type: "endScreen", headline: { default: "" } });
  });

  test("seeds the headline for every survey language", () => {
    const patch = getEndingCardTypeChangePatch(redirectCard, "endScreen", ["default", "de"]);

    expect(patch).toEqual({ type: "endScreen", headline: { default: "", de: "" } });
  });

  test("keeps an existing headline instead of blanking it", () => {
    const patch = getEndingCardTypeChangePatch(endScreenCard, "endScreen", ["default"]);

    expect(patch).toEqual({ type: "endScreen" });
  });

  test("keeps the headline a round trip without a save left on the card", () => {
    // The type switch patches only `type`, so an unsaved endScreen -> redirect -> endScreen round
    // trip reaches this call as a redirect card that still carries its original headline.
    const unsavedRoundTrip = { ...redirectCard, headline: { default: "Thanks!" } } as TSurveyEnding;

    expect(getEndingCardTypeChangePatch(unsavedRoundTrip, "endScreen", ["default"])).toEqual({
      type: "endScreen",
    });
  });

  test("seeds a headline when the card has an empty one", () => {
    const patch = getEndingCardTypeChangePatch({ ...endScreenCard, headline: undefined }, "endScreen", [
      "default",
    ]);

    expect(patch).toEqual({ type: "endScreen", headline: { default: "" } });
  });

  test("switching to redirectToUrl only changes the type", () => {
    expect(getEndingCardTypeChangePatch(endScreenCard, "redirectToUrl", ["default"])).toEqual({
      type: "redirectToUrl",
    });
  });
});
