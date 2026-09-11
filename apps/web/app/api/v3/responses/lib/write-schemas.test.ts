import { describe, expect, test, vi } from "vitest";
import { ZV3CreateResponseBody, ZV3PatchResponseBody } from "./schemas";

vi.mock("server-only", () => ({}));

const SURVEY_ID = "clsv000000000000000000001";
const create = (over: Record<string, unknown> = {}) =>
  ZV3CreateResponseBody.safeParse({ surveyId: SURVEY_ID, finished: false, data: {}, ...over });

describe("ZV3CreateResponseBody", () => {
  test("the three required fields are enough", () => {
    expect(create().success).toBe(true);
  });

  test.each(["surveyId", "finished", "data"])("%s is required", (field) => {
    const body: Record<string, unknown> = { surveyId: SURVEY_ID, finished: false, data: {} };
    delete body[field];

    expect(ZV3CreateResponseBody.safeParse(body).success).toBe(false);
  });

  /** The contract's `uniqueItems`. Duplicates would make the applied set unreconcilable with what was sent. */
  test("duplicate tag ids are refused", () => {
    const dup = "cltg000000000000000000001";

    expect(create({ tags: [dup, dup] }).success).toBe(false);
    expect(create({ tags: [dup] }).success).toBe(true);
  });

  test.each([
    ["a string answer", "text"],
    ["a number answer", 7],
    ["a multi-select answer", ["a", "b"]],
    ["a matrix answer", { row: "agree" }],
  ])("data accepts %s", (_label, value) => {
    expect(create({ data: { q1: value } }).success).toBe(true);
  });

  test("data refuses a shape no element can store", () => {
    expect(create({ data: { q1: { nested: { deep: 1 } } } }).success).toBe(false);
  });

  test.each([
    ["a string", "enterprise"],
    ["a number", 42],
    ["a boolean", true],
    ["null, which clears", null],
  ])("embeddedData accepts %s", (_label, value) => {
    expect(create({ embeddedData: { plan: value } }).success).toBe(true);
  });

  test("embeddedData refuses an array", () => {
    expect(create({ embeddedData: { plan: ["a"] } }).success).toBe(false);
  });

  /** Server-owned and never writable, whatever the caller intends by sending them. */
  test.each(["createdAt", "updatedAt", "userId", "contactAttributes", "variables"])(
    "%s is rejected rather than ignored",
    (field) => {
      expect(create({ [field]: "x" }).success).toBe(false);
    }
  );

  test.each(["country", "userAgent", "ipAddress", "utmSource", "pagePath"])(
    "meta.%s is rejected — the route derives it, so a supplied value would be fiction",
    (field) => {
      expect(create({ meta: { [field]: "x" } }).success).toBe(false);
    }
  );

  test("meta accepts the three the contract admits", () => {
    expect(
      create({ meta: { source: "zendesk", url: "https://x.test/t/1", action: "clicked" } }).success
    ).toBe(true);
  });

  /** Clamped server-side rather than rejected, so only a non-number fails here. */
  test("ttc takes any number, including one past the clamp", () => {
    expect(create({ ttc: { q1: 999_999_999 } }).success).toBe(true);
    expect(create({ ttc: { q1: "fast" } }).success).toBe(false);
  });
});

describe("ZV3PatchResponseBody", () => {
  test("an empty body is refused — a caller sending nothing has a bug", () => {
    expect(ZV3PatchResponseBody.safeParse({}).success).toBe(false);
  });

  test.each(["finished", "endingId", "language", "data", "embeddedData", "tags"])(
    "%s alone is a valid patch",
    (field) => {
      const value = { finished: true, endingId: null, language: null, data: {}, embeddedData: {}, tags: [] }[
        field as "finished"
      ];

      expect(ZV3PatchResponseBody.safeParse({ [field]: value }).success).toBe(true);
    }
  );

  /** Timing and submission context describe the original event, so they are set once and not revised. */
  test.each(["meta", "ttc", "surveyId", "contactId", "displayId", "singleUseId", "createdAt"])(
    "%s is create-only and rejected on patch",
    (field) => {
      expect(ZV3PatchResponseBody.safeParse({ finished: true, [field]: "x" }).success).toBe(false);
    }
  );

  /** Unlike create: a patch applies tags as a set, so a repeat is redundant rather than ambiguous. */
  test("repeated tag ids are accepted on patch", () => {
    const dup = "cltg000000000000000000001";

    expect(ZV3PatchResponseBody.safeParse({ tags: [dup, dup] }).success).toBe(true);
  });
});
