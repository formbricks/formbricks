import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { boundedSchema } from "./bounded-parse";
import { V3_INVALID_PARAMS_MAX } from "./invalid-params";

const entries = <T>(count: number, entry: (index: number) => T): T[] =>
  Array.from({ length: count }, (_unused, index) => entry(index));

const issuesOf = (result: z.ZodSafeParseResult<unknown>) => (result.success ? [] : result.error.issues);

const TRUNCATED = "Further problems were not checked; fix the ones above and retry";

describe("boundedSchema", () => {
  const item = z.object({ id: z.string(), label: z.string() });
  const list = z.object({ items: z.array(item) });

  test("passes a valid input through to the schema's own output", () => {
    const schema = z.object({ name: z.string().trim(), count: z.number().prefault(1) });

    expect(boundedSchema(schema).parse({ name: "  a  " })).toEqual({ name: "a", count: 1 });
  });

  test("runs a leading preprocess once per parse, valid or not", () => {
    const normalize = vi.fn((value: unknown) => value);
    const schema = boundedSchema(z.preprocess(normalize, list));

    schema.safeParse({ items: [{ id: "a", label: "b" }] });
    schema.safeParse({ items: [{}] });

    expect(normalize).toHaveBeenCalledTimes(2);
  });

  test("reports the same issues as a full parse while they fit under the cap", () => {
    const input = { items: [...entries(300, () => ({ id: "a", label: "b" })), { id: 1 }, { label: 2 }] };

    const bounded = issuesOf(boundedSchema(list).safeParse(input));
    const full = issuesOf(list.safeParse(input));

    expect(bounded.map(({ path, message }) => ({ path, message }))).toEqual(
      full.map(({ path, message }) => ({ path, message }))
    );
  });

  test("stops at the cap and says the list is not complete", () => {
    const issues = issuesOf(boundedSchema(list).safeParse({ items: entries(1000, () => ({})) }));

    expect(issues).toHaveLength(V3_INVALID_PARAMS_MAX);
    expect(issues.at(-1)).toMatchObject({ message: TRUNCATED, path: [] });
  });

  // ENG-4100: Zod has no early stop. Even `validate` builds every issue a refinement or a string check
  // reports, and past ~120k of them in one subtree its issue merge overflows the stack.
  test("returns the cap where a full parse, or a validate, overflows the stack", () => {
    const groups = z.object({
      groups: z.array(z.object({ items: z.array(z.string().min(3).regex(/x/).endsWith("z")) })),
    });
    const input = { groups: [{ items: entries(49_000, () => "a") }] };

    expect(() => groups.safeParse(input)).toThrow(RangeError);
    expect(() => groups.validate(input)).toThrow(RangeError);
    expect(issuesOf(boundedSchema(groups).safeParse(input))).toHaveLength(V3_INVALID_PARAMS_MAX);
  });

  // Work must not grow with depth: one bad leaf under a deep chain of big, valid levels used to be
  // validated again at every level, seconds of CPU for one issue.
  test("checks each value about once however deep the bad leaf sits", () => {
    let checks = 0;
    const leaf = z.string().superRefine(() => {
      checks += 1;
    });
    type TNode = { leaves: string[]; next?: TNode };
    const node: z.ZodType<TNode> = z.lazy(() => z.object({ leaves: z.array(leaf), next: node.optional() }));

    const depth = 60;
    const build = (level: number): TNode => ({
      leaves: entries(300, (index) => (level === depth && index === 0 ? (1 as unknown as string) : "ok")),
      ...(level < depth ? { next: build(level + 1) } : {}),
    });
    const leaves = (depth + 1) * 300;

    const issues = issuesOf(boundedSchema(node).safeParse(build(0)));

    expect(issues).toHaveLength(1);
    // Each leaf is checked by one `validate`, and a failing small subtree is parsed once more.
    expect(checks).toBeLessThan(leaves * 2);
  });

  // A wide object under a deep chain: sizing it again from every level above enumerated its keys once
  // per level, over a minute of CPU for one 2 MB request.
  test("enumerates a wide object's keys a constant number of times however deep it sits", () => {
    let enumerations = 0;
    const wide = new Proxy(
      Object.fromEntries(entries(20_000, (index) => [`k${index}`, index === 0 ? "bad" : 0])),
      {
        ownKeys(target) {
          enumerations += 1;
          return Reflect.ownKeys(target);
        },
      }
    );
    type TNode = { next?: TNode; payload?: Record<string, number> };
    const node: z.ZodType<TNode> = z.lazy(() =>
      z.object({ next: node.optional(), payload: z.record(z.string(), z.number()).optional() })
    );
    // The payload holds one bad value, so the input is not a `TNode`.
    let input: unknown = { payload: wide };
    for (let level = 0; level < 80; level += 1) {
      input = { next: input };
    }

    const issues = issuesOf(boundedSchema(node).safeParse(input));

    expect(issues).toHaveLength(1);
    expect(enumerations).toBeLessThan(10);
  });

  test("reports a big container's own checks through the schema's parse", () => {
    const schema = z.object({ items: z.array(item).max(299) }).strict();

    expect(
      issuesOf(boundedSchema(schema).safeParse({ items: entries(300, () => ({ id: "a", label: "b" })) }))
    ).toEqual([expect.objectContaining({ code: "too_big", path: ["items"] })]);
    expect(issuesOf(boundedSchema(schema).safeParse({ items: [], extra: 1 }))).toEqual([
      expect.objectContaining({ code: "unrecognized_keys", path: [] }),
    ]);
  });

  test("does not hand a pipe's input on when the walk stopped at its input side", () => {
    const schema = z
      .object({ items: z.array(z.unknown()) })
      .strict()
      .pipe(z.object({ items: z.array(z.object({ y: z.number(), z: z.number() })) }));

    const issues = issuesOf(
      boundedSchema(schema).safeParse({ extra: 1, items: entries(30_000, () => ({})) })
    );

    expect(issues.length).toBeLessThanOrEqual(V3_INVALID_PARAMS_MAX);
  });

  test("walks a record per key", () => {
    const schema = z.object({ labels: z.record(z.string(), z.string()) });
    const labels = Object.fromEntries(entries(5000, (index) => [`k${index}`, 0]));

    const issues = issuesOf(boundedSchema(schema).safeParse({ labels }));

    expect(issues).toHaveLength(V3_INVALID_PARAMS_MAX);
    expect(issues[0]).toMatchObject({ code: "invalid_type", path: ["labels", "k0"] });
  });

  describe("unions", () => {
    const big = <T>(entry: T) => ({ children: entries(300, () => entry) });

    test("walks a discriminated union's matching branch: one issue for one missing field", () => {
      const element = z.discriminatedUnion("type", [
        z.object({ type: z.literal("text"), children: z.array(z.string()), placeholder: z.string() }),
        z.object({ type: z.literal("choice"), children: z.array(z.string()), choices: z.array(z.string()) }),
      ]);

      const issues = issuesOf(boundedSchema(element).safeParse({ type: "choice", ...big("a") }));

      expect(issues).toEqual([expect.objectContaining({ path: ["choices"], code: "invalid_type" })]);
    });

    test("gives a discriminated union's own refusal when no branch matches", () => {
      const element = z.discriminatedUnion("type", [
        z.object({ type: z.literal("text"), children: z.array(z.string()) }),
        z.object({ type: z.literal("choice"), children: z.array(z.string()) }),
      ]);
      const input = { type: "other", ...big("a") };

      // Zod stops at the discriminator here, so its own parse is cheap and the reference.
      expect(issuesOf(boundedSchema(element).safeParse(input))).toEqual(issuesOf(element.safeParse(input)));
      expect(issuesOf(element.safeParse(input))).toHaveLength(1);
    });

    test("reports only the best-fitting branch of a plain union", () => {
      const condition = z.union([
        z.object({ id: z.string(), operator: z.string(), children: z.array(z.string()) }),
        z.object({ id: z.string(), connector: z.string(), conditions: z.array(z.unknown()) }),
      ]);

      const issues = issuesOf(boundedSchema(condition).safeParse({ id: "c", ...big("a") }));

      expect(issues.map((issue) => issue.path)).toEqual([["operator"]]);
    });

    // Splitting is what bounds the work: parsing the union whole would run every leaf's check (and build
    // its issue) before the cap could apply.
    test.each([
      [
        "discriminated",
        (leaf: z.ZodType) =>
          z.discriminatedUnion("type", [
            z.object({ type: z.literal("a"), children: z.array(leaf) }),
            z.object({ type: z.literal("b"), children: z.array(leaf) }),
          ]),
      ],
      [
        "plain",
        (leaf: z.ZodType) =>
          z.union([
            z.object({ type: z.literal("a"), children: z.array(leaf) }),
            z.object({ type: z.literal("b"), children: z.array(leaf) }),
          ]),
      ],
    ])("stops checking a %s union's big branch at the cap", (_kind, build) => {
      let checks = 0;
      const leaf = z.string().superRefine((_value, ctx) => {
        checks += 1;
        ctx.addIssue({ code: "custom", message: "bad" });
      });

      const issues = issuesOf(
        boundedSchema(build(leaf)).safeParse({ type: "b", children: entries(5000, () => "x") })
      );

      expect(issues).toHaveLength(V3_INVALID_PARAMS_MAX);
      expect(checks).toBeLessThan(500);
    });

    test.each([
      ["a record", z.union([z.object({ a: z.string() }), z.record(z.string(), z.number())])],
      [
        "a preprocessed branch",
        z.union([
          z.object({ a: z.string() }),
          z.preprocess((value) => value, z.record(z.string(), z.number())),
        ]),
      ],
      [
        "an optional literal",
        z.union([
          z.object({ a: z.string() }),
          z.object({ kind: z.literal("x").optional(), values: z.array(z.number()) }),
        ]),
      ],
    ])("accepts a big value valid only for %s branch", (_name, schema) => {
      const value =
        _name === "an optional literal"
          ? { values: entries(300, (index) => index) }
          : Object.fromEntries(entries(300, (index) => [`k${index}`, index]));

      expect(schema.safeParse(value).success).toBe(true);
      expect(boundedSchema(schema).safeParse(value).success).toBe(true);
    });

    // A value that fits both branches at every level of a chain: each branch is walked once per value,
    // not once per path down the chain (2^depth).
    test("stays linear on a chain of values ambiguous between branches", () => {
      let checks = 0;
      const leaf = z.string().superRefine(() => {
        checks += 1;
      });
      type TGroup = { children: string[]; next?: TGroup };
      const group: z.ZodType<TGroup> = z.lazy(() =>
        z.union([
          z.object({ children: z.array(leaf), next: group.optional(), a: z.string().optional() }),
          z.object({ children: z.array(leaf), next: group.optional(), b: z.string().optional() }),
        ])
      );
      const depth = 13;
      const build = (level: number): TGroup => ({
        children: entries(300, () => "ok"),
        next: level < depth ? build(level + 1) : (0 as unknown as TGroup),
      });

      boundedSchema(group).safeParse(build(0));

      expect(checks).toBeLessThan((depth + 1) * 300 * 6);
    });
  });

  test("keeps the schema's output side for JSON Schema generation", () => {
    const schema = z.object({ items: z.array(item).max(5) });

    expect(z.toJSONSchema(boundedSchema(schema), { io: "output", unrepresentable: "any" })).toMatchObject({
      properties: { items: { type: "array", maxItems: 5 } },
    });
  });
});
