import { describe, expect, test } from "vitest";
import {
  V3_REQUEST_ARRAY_MAX_ITEMS,
  V3_REQUEST_ARRAY_MAX_TOTAL_ELEMENTS,
  V3_REQUEST_MAX_DEPTH,
  arrayBudgetInvalidParam,
  findArrayBudgetViolation,
} from "./array-budget";

const junk = (count: number) => Array.from({ length: count }, () => 0);

describe("findArrayBudgetViolation", () => {
  test("accepts an array at the cap and refuses one more, naming its path", () => {
    expect(findArrayBudgetViolation({ blocks: [{ elements: junk(V3_REQUEST_ARRAY_MAX_ITEMS) }] })).toBeNull();

    expect(
      findArrayBudgetViolation({ blocks: [{ elements: junk(V3_REQUEST_ARRAY_MAX_ITEMS + 1) }] })
    ).toEqual({
      kind: "array_too_long",
      path: "blocks.0.elements",
      length: V3_REQUEST_ARRAY_MAX_ITEMS + 1,
    });
  });

  test("caps the elements of the whole body, not only each array", () => {
    // Every array is within its own cap; together they are not. This is the shape a per-array bound
    // alone lets through: many arrays of many junk entries, one Zod issue per entry.
    const arrays = Math.ceil(V3_REQUEST_ARRAY_MAX_TOTAL_ELEMENTS / V3_REQUEST_ARRAY_MAX_ITEMS) + 1;
    const body = {
      blocks: Array.from({ length: arrays }, () => ({ elements: junk(V3_REQUEST_ARRAY_MAX_ITEMS) })),
    };

    const violation = findArrayBudgetViolation(body);

    expect(violation?.kind).toBe("too_many_elements");
    expect(violation?.path).toBe("blocks.49.elements");
  });

  test("reports the first offending array in document order", () => {
    // `invalid_params[].name` on every v3 route depends on this order.
    const body = {
      first: [{ nested: junk(V3_REQUEST_ARRAY_MAX_ITEMS + 1) }],
      second: junk(V3_REQUEST_ARRAY_MAX_ITEMS + 1),
    };

    expect(findArrayBudgetViolation(body)?.path).toBe("first.0.nested");
  });

  const nest = (levels: number, wrap: (inner: unknown) => unknown) => {
    let value: unknown = 0;
    for (let level = 0; level < levels; level += 1) {
      value = wrap(value);
    }
    return value;
  };

  test("accepts nesting at the depth cap and refuses one level more, naming where", () => {
    expect(findArrayBudgetViolation(nest(V3_REQUEST_MAX_DEPTH, (inner) => ({ a: inner })))).toBeNull();

    const violation = findArrayBudgetViolation(nest(V3_REQUEST_MAX_DEPTH + 1, (inner) => ({ a: inner })));

    expect(violation).toMatchObject({ kind: "too_deep", path: "a.a.a.a.a.a.a.a.a.a.…" });
    expect(violation && arrayBudgetInvalidParam(violation, "body").reason).toBe(
      `Too deep: expected the request to nest <=${V3_REQUEST_MAX_DEPTH} levels`
    );
  });

  test("refuses deep nesting whatever its shape, without recursing", () => {
    // A sibling on every level keeps each level's frame open; the cap is what bounds that. And a
    // recursive walk would overflow the stack around ten thousand levels, so the walk stays iterative.
    const withSiblings = nest(40_000, (inner) => ({ a: inner, b: 0 }));
    const arrays = nest(40_000, (inner) => [inner, 0]);

    expect(findArrayBudgetViolation(withSiblings)?.kind).toBe("too_deep");
    expect(findArrayBudgetViolation(arrays)?.kind).toBe("too_deep");
  });

  test("clips the reported path to ten segments and 64 characters per key", () => {
    // The path is caller-shaped too: 60k nested arrays put a 100 KB `name` into the 400 before this.
    let value: unknown = junk(V3_REQUEST_ARRAY_MAX_ITEMS + 1);
    for (let depth = 0; depth < 30; depth += 1) {
      value = [value];
    }
    const longKey = "k".repeat(100);

    const violation = findArrayBudgetViolation({ [longKey]: value });

    expect(violation?.kind).toBe("array_too_long");
    expect(violation?.path).toBe(
      [`${"k".repeat(64)}…`, ...Array.from({ length: 9 }, () => "0"), "…"].join(".")
    );
  });

  test("ignores scalars and objects without arrays", () => {
    expect(findArrayBudgetViolation({ name: "x", nested: { flag: true, none: null } })).toBeNull();
    expect(findArrayBudgetViolation("string")).toBeNull();
    expect(findArrayBudgetViolation(null)).toBeNull();
  });
});

describe("arrayBudgetInvalidParam", () => {
  test("uses Zod's too_big wording for a long array and the fallback name for the root", () => {
    expect(arrayBudgetInvalidParam({ kind: "array_too_long", path: "", length: 5 }, "body")).toEqual({
      name: "body",
      reason: `Too big: expected array to have <=${V3_REQUEST_ARRAY_MAX_ITEMS} items`,
    });
  });

  test("names the array that crossed the total", () => {
    expect(
      arrayBudgetInvalidParam({ kind: "too_many_elements", path: "blocks.9.elements", total: 1 }, "body")
    ).toEqual({
      name: "blocks.9.elements",
      reason: `Too big: expected the request to carry <=${V3_REQUEST_ARRAY_MAX_TOTAL_ELEMENTS} array elements in total`,
    });
  });
});
