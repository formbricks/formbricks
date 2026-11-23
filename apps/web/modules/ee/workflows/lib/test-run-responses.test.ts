import { describe, expect, test } from "vitest";
import {
  TEST_RESPONSE_FIRST_ANSWER_MAX_LENGTH,
  getElementIdsFromBlocks,
  getFirstAnswerText,
  getTestResponseMismatch,
  resolveSelectedTestResponseId,
} from "./test-run-responses";

describe("getElementIdsFromBlocks", () => {
  test("lists the questions in survey order across blocks, skipping malformed entries", () => {
    const blocks = [
      { id: "b1", elements: [{ id: "q1" }, { id: "q2" }] },
      { id: "b2", elements: [{ type: "openText" }, { id: "q3" }] },
      { id: "b3" },
      null,
    ];

    expect(getElementIdsFromBlocks(blocks)).toEqual(["q1", "q2", "q3"]);
    expect(getElementIdsFromBlocks(null)).toEqual([]);
  });
});

describe("getFirstAnswerText", () => {
  test("is the first answered question in survey order, not the data's key order", () => {
    expect(getFirstAnswerText(["q1", "q2"], { q2: "second", q1: "first" })).toBe("first");
  });

  test("skips unanswered and blank questions and questions the survey no longer has", () => {
    expect(getFirstAnswerText(["q1", "q2", "q3"], { q1: "  ", q2: [], q3: 9, gone: "x" })).toBe("9");
    expect(getFirstAnswerText(["q1"], { q1: "" })).toBeNull();
    expect(getFirstAnswerText(["q1"], "not data")).toBeNull();
  });

  test("joins choice lists and object answers into one line", () => {
    expect(getFirstAnswerText(["q1"], { q1: ["Email", "Phone"] })).toBe("Email, Phone");
    expect(getFirstAnswerText(["q1"], { q1: { street: "Main St", city: "Berlin", zip: "" } })).toBe(
      "Main St, Berlin"
    );
    expect(getFirstAnswerText(["q1"], { q1: "two\n\nlines" })).toBe("two lines");
  });

  test("cuts a long answer to the limit", () => {
    const text = getFirstAnswerText(["q1"], { q1: "a".repeat(500) });

    expect(text).toHaveLength(TEST_RESPONSE_FIRST_ANSWER_MAX_LENGTH);
    expect(text?.endsWith("…")).toBe(true);
  });
});

describe("resolveSelectedTestResponseId", () => {
  const responses = [
    { id: "partial-newest", finished: false },
    { id: "completed-newest", finished: true },
    { id: "completed-older", finished: true },
  ];

  test("defaults to the newest completed response", () => {
    expect(resolveSelectedTestResponseId(responses, null)).toBe("completed-newest");
  });

  test("keeps the picked response while it is listed", () => {
    expect(resolveSelectedTestResponseId(responses, "partial-newest")).toBe("partial-newest");
    expect(resolveSelectedTestResponseId(responses, "no-longer-listed")).toBe("completed-newest");
  });

  test("falls back to the newest response when none is completed, and to none when empty", () => {
    expect(resolveSelectedTestResponseId([{ id: "p1", finished: false }], null)).toBe("p1");
    expect(resolveSelectedTestResponseId([], null)).toBeNull();
  });
});

describe("getTestResponseMismatch", () => {
  test("a partial response would not fire a real run", () => {
    expect(getTestResponseMismatch({ finished: false, endingId: null }, [])).toBe("partial");
  });

  test("with no endings selected, any completed response would fire one, even with no ending", () => {
    expect(getTestResponseMismatch({ finished: true, endingId: null }, [])).toBeNull();
    expect(getTestResponseMismatch({ finished: true, endingId: "end-a" }, [])).toBeNull();
  });

  test("with endings selected, only a response that reached one of them would", () => {
    expect(getTestResponseMismatch({ finished: true, endingId: "end-a" }, ["end-a"])).toBeNull();
    expect(getTestResponseMismatch({ finished: true, endingId: "end-b" }, ["end-a"])).toBe("other_ending");
    expect(getTestResponseMismatch({ finished: true, endingId: null }, ["end-a"])).toBe("other_ending");
  });
});
