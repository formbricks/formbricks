import { describe, expect, test } from "vitest";
import { FILTER_TEXT_MAX_LENGTH, IDENTIFIER_MAX_LENGTH, PICKED_ITEMS_MAX } from "./limits";
import { ZResponseFilterCriteriaBody } from "./response-filter-criteria";

const text = (length: number) => "a".repeat(length);
const refusedAt = (criteria: unknown) =>
  ZResponseFilterCriteriaBody.safeParse(criteria).error?.issues.map(({ path }) => path.join(".")) ?? [];

describe("ZResponseFilterCriteriaBody", () => {
  test.each([
    ["data", (key: string) => ({ data: { [key]: { op: "submitted" } } })],
    ["contactAttributes", (key: string) => ({ contactAttributes: { [key]: { op: "equals", value: "x" } } })],
    ["variables", (key: string) => ({ variables: { [key]: { op: "isSet" } } })],
    ["reserved", (key: string) => ({ reserved: { [key]: { op: "isSet" } } })],
    ["others", (key: string) => ({ others: { [key]: { op: "equals", value: "x" } } })],
    ["meta", (key: string) => ({ meta: { [key]: { op: "equals", value: "x" } } })],
  ])("takes a %s key at the identifier cap and refuses one longer", (field, build) => {
    expect(refusedAt(build(text(IDENTIFIER_MAX_LENGTH)))).toEqual([]);
    expect(refusedAt(build(text(IDENTIFIER_MAX_LENGTH + 1)))).toEqual([field]);
  });

  test.each([
    ["dataAnd.0.key", (n: number) => ({ dataAnd: [{ key: text(n), condition: { op: "submitted" } }] })],
  ])("takes %s at the identifier cap and refuses one longer", (field, build) => {
    expect(refusedAt(build(IDENTIFIER_MAX_LENGTH))).toEqual([]);
    expect(refusedAt(build(IDENTIFIER_MAX_LENGTH + 1))).toEqual([field]);
  });

  test.each([
    ["data.q1.value", (n: number) => ({ data: { q1: { op: "contains", value: text(n) } } })],
    ["data.q1.max", (n: number) => ({ data: { q1: { op: "inRange", min: "2026-01-01", max: text(n) } } })],
    ["data.q1.value.1", (n: number) => ({ data: { q1: { op: "includesAll", value: ["a", text(n)] } } })],
    ["data.q1.value.row", (n: number) => ({ data: { q1: { op: "matrix", value: { row: text(n) } } } })],
    ["data.q1.value.q2.0", (n: number) => ({ data: { q1: { op: "isAnyOf", value: { q2: [text(n)] } } } })],
    [
      "dataAnd.0.condition.value",
      (n: number) => ({ dataAnd: [{ key: "q1", condition: { op: "equals", value: text(n) } }] }),
    ],
    [
      "contactAttributes.plan.value",
      (n: number) => ({ contactAttributes: { plan: { op: "equals", value: text(n) } } }),
    ],
    [
      "variables.score.value",
      (n: number) => ({ variables: { score: { op: "startsWith", value: text(n) } } }),
    ],
    ["others.language.value.0", (n: number) => ({ others: { language: { op: "in", value: [text(n)] } } })],
    ["meta.source.value", (n: number) => ({ meta: { source: { op: "endsWith", value: text(n) } } })],
    ["tags.applied.0", (n: number) => ({ tags: { applied: [text(n)] } })],
  ])("takes %s at the filter-text cap and refuses one longer", (field, build) => {
    expect(refusedAt(build(FILTER_TEXT_MAX_LENGTH))).toEqual([]);
    expect(refusedAt(build(FILTER_TEXT_MAX_LENGTH + 1))).toEqual([field]);
  });

  test("refuses a matrix row longer than the filter-text cap", () => {
    expect(
      refusedAt({ data: { q1: { op: "matrix", value: { [text(FILTER_TEXT_MAX_LENGTH + 1)]: "1" } } } })
    ).toEqual(["data.q1.value"]);
  });

  test(`takes an isAnyOf over ${PICKED_ITEMS_MAX} questions and refuses one more`, () => {
    const isAnyOf = (n: number) => ({
      data: {
        q1: {
          op: "isAnyOf",
          value: Object.fromEntries(Array.from({ length: n }, (_, i) => [`q${i}`, ["a"]])),
        },
      },
    });
    expect(refusedAt(isAnyOf(PICKED_ITEMS_MAX))).toEqual([]);
    expect(refusedAt(isAnyOf(PICKED_ITEMS_MAX + 1))).toEqual(["data.q1.value"]);
  });

  // ENG-3984 merge: the Responses quick filter now sends several statuses at once (#9989). The body schema
  // wraps the shared filter, so the field must survive it rather than be stripped as an unknown key.
  test("keeps the ticked statuses, and refuses one the quick filter doesn't offer", () => {
    const statuses = ["complete", "lowQuality"];
    expect(ZResponseFilterCriteriaBody.parse({ statuses })).toEqual({ statuses });
    expect(refusedAt({ statuses: ["archived"] })).toEqual(["statuses.0"]);
  });
});
