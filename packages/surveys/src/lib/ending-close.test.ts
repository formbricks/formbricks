import { describe, expect, test } from "vitest";
import type { TSurveyEnding } from "@formbricks/types/surveys/types";
import { ENDING_CARD_CLOSE_DELAY_MS, getEndingCloseDelay } from "./ending-close";

const endScreen = { id: "end", type: "endScreen" } as TSurveyEnding;
const redirect = { id: "redirect", type: "redirectToUrl", url: "https://example.com" } as TSurveyEnding;

describe("getEndingCloseDelay", () => {
  describe("modal surveys", () => {
    test("close 3 seconds after the ending card by default", () => {
      expect(getEndingCloseDelay({ survey: { endings: [endScreen] }, mode: "modal" })).toBe(
        ENDING_CARD_CLOSE_DELAY_MS
      );
      expect(
        getEndingCloseDelay({ survey: { endings: [endScreen], keepEndingCardOpen: false }, mode: "modal" })
      ).toBe(3000);
    });

    test("schedule no close when the ending card is kept open", () => {
      expect(
        getEndingCloseDelay({ survey: { endings: [endScreen], keepEndingCardOpen: true }, mode: "modal" })
      ).toBeNull();
    });

    test.each([false, true])("close immediately with no ending card (keepEndingCardOpen: %s)", (keep) => {
      expect(getEndingCloseDelay({ survey: { endings: [], keepEndingCardOpen: keep }, mode: "modal" })).toBe(
        0
      );
    });

    test.each([false, true])(
      "never close when the first ending redirects (keepEndingCardOpen: %s)",
      (keep) => {
        expect(
          getEndingCloseDelay({
            survey: { endings: [redirect, endScreen], keepEndingCardOpen: keep },
            mode: "modal",
          })
        ).toBeNull();
      }
    );

    test("only the first ending decides whether it redirects", () => {
      expect(getEndingCloseDelay({ survey: { endings: [endScreen, redirect] }, mode: "modal" })).toBe(3000);
    });
  });

  describe("inline surveys", () => {
    test.each([
      [[endScreen], false],
      [[endScreen], true],
      [[], false],
      [[redirect], false],
    ])("never close (endings: %j, keepEndingCardOpen: %s)", (endings, keep) => {
      expect(
        getEndingCloseDelay({ survey: { endings, keepEndingCardOpen: keep }, mode: "inline" })
      ).toBeNull();
    });
  });
});
