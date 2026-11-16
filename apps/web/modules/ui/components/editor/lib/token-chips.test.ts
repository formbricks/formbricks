import { describe, expect, test } from "vitest";
import { splitTextAtTokens } from "./token-chips";

const LINK = "#survey-link#";

describe("splitTextAtTokens", () => {
  test("returns null for text without a token, so the node is left alone", () => {
    expect(splitTextAtTokens("Hello there", [LINK])).toBeNull();
    expect(splitTextAtTokens("#survey-link", [LINK])).toBeNull();
  });

  test("splits text around each token, keeping the text on both sides", () => {
    expect(splitTextAtTokens(`Take it: ${LINK} thanks`, [LINK])).toEqual([
      { kind: "text", text: "Take it: " },
      { kind: "token", token: LINK },
      { kind: "text", text: " thanks" },
    ]);
  });

  test("a token on its own is a single part", () => {
    expect(splitTextAtTokens(LINK, [LINK])).toEqual([{ kind: "token", token: LINK }]);
  });

  test("finds repeated and adjacent tokens, and several kinds of token", () => {
    expect(splitTextAtTokens(`${LINK}${LINK} and #other#`, [LINK, "#other#"])).toEqual([
      { kind: "token", token: LINK },
      { kind: "token", token: LINK },
      { kind: "text", text: " and " },
      { kind: "token", token: "#other#" },
    ]);
  });

  test("ignores empty tokens instead of looping", () => {
    expect(splitTextAtTokens("abc", [""])).toBeNull();
  });
});
