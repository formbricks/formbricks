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

    // The best fit is declared last, so declaration order alone would report the wrong branch.
    test("reports only the best-fitting branch of a plain union", () => {
      const condition = z.union([
        z.object({ id: z.string(), connector: z.string(), conditions: z.array(z.unknown()) }),
        z.object({ id: z.string(), operator: z.string(), children: z.array(z.string()) }),
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

    const bigRecord = () => Object.fromEntries(entries(300, (index) => [`k${index}`, index]));

    test.each<[string, z.ZodType, unknown]>([
      ["a record", z.union([z.object({ a: z.string() }), z.record(z.string(), z.number())]), bigRecord()],
      [
        "a preprocessed branch",
        z.union([
          z.object({ a: z.string() }),
          z.preprocess((value) => value, z.record(z.string(), z.number())),
        ]),
        bigRecord(),
      ],
      [
        "an optional literal",
        z.union([
          z.object({ a: z.string() }),
          z.object({ kind: z.literal("x").optional(), values: z.array(z.number()) }),
        ]),
        { values: entries(300, (index) => index) },
      ],
    ])("accepts a big value valid only for %s branch", (_name, schema, value) => {
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

  // Each side of an intersection is walked once per value: a recursive one was walked once per side at
  // every level, 2^depth.
  test("walks a recursive intersection in linear time", () => {
    let checks = 0;
    const leaf = z.string().superRefine(() => {
      checks += 1;
    });
    type TNode = { children: string[]; next?: TNode };
    const node: z.ZodType<TNode> = z.lazy(() =>
      z.object({ children: z.array(leaf), next: node.optional() }).and(z.object({ children: z.array(leaf) }))
    );
    const depth = 14;
    const build = (level: number): unknown => ({
      children: entries(300, () => "ok"),
      ...(level < depth ? { next: build(level + 1) } : { next: 0 }),
    });

    boundedSchema(node).safeParse(build(0));

    expect(checks).toBeLessThan((depth + 1) * 300 * 6);
  });

  // Where Zod accepts something the walk could misjudge on its own, the guard defers to Zod.
  describe("agrees with Zod above the threshold", () => {
    const padding = { pad: entries(300, (index) => index) };
    const withPad = (shape: Record<string, z.ZodType>) => z.object({ ...shape, pad: z.array(z.number()) });
    const cyclic = () => {
      const value: Record<string, unknown> = { a: "x", ...padding };
      value.self = value;
      return value;
    };
    type TLoop = { next?: TLoop; pad: number[] };
    const loop: z.ZodType<TLoop> = z.lazy(() =>
      z.object({ next: loop.optional(), pad: z.array(z.number()) })
    );
    const looped = () => {
      const value: Record<string, unknown> = { ...padding };
      value.next = value;
      return value;
    };

    test.each<[string, z.ZodType, () => unknown]>([
      [
        "a numeric-key record",
        withPad({ byIndex: z.record(z.number(), z.string()) }),
        () => ({ byIndex: { 1: "a", 2: "b" }, ...padding }),
      ],
      [
        "a loose record",
        withPad({ labels: z.looseRecord(z.enum(["a"]), z.string()) }),
        () => ({ labels: { a: "x", other: 1 }, ...padding }),
      ],
      [
        "a codec",
        withPad({
          when: z.codec(z.iso.datetime(), z.date(), {
            decode: (s) => new Date(s),
            encode: (d) => d.toISOString(),
          }),
        }),
        () => ({ when: "2026-01-01T00:00:00Z", ...padding }),
      ],
      ["an absent exactOptional key", withPad({ note: z.string().exactOptional() }), () => ({ ...padding })],
      [
        "a `__proto__` record key",
        withPad({ labels: z.record(z.string(), z.string()) }),
        () => ({ labels: JSON.parse('{"__proto__":"x","a":"b"}') as unknown, ...padding }),
      ],
      [
        "a numeric key holding a big value",
        z.record(z.number(), z.object({ items: z.array(z.number()) })),
        () => ({ 1: { items: entries(300, (index) => index) } }),
      ],
      [
        "a loose record passing a big value through",
        z.looseRecord(z.enum(["a"]), z.string()),
        () => ({ a: "x", other: { items: entries(300, (index) => index) } }),
      ],
      [
        "a refined record whose keys Zod reads as numbers",
        z.record(z.number(), z.string()).refine((record) => Object.keys(record).length >= 2),
        () => Object.fromEntries(entries(300, (index) => [String(index), "x"])),
      ],
      [
        "a union branch whose exactOptional literal is absent",
        z.union([
          z.object({ kind: z.literal("a").exactOptional(), list: z.array(z.string()) }),
          z.object({ other: z.string().optional(), list: z.array(z.number()) }),
        ]),
        () => ({ list: entries(300, () => "x") }),
      ],
      [
        "a loose object's extra keys named like prototype members",
        z.looseObject({ pad: z.array(z.number()) }),
        () => ({
          ...padding,
          ...JSON.parse('{"constructor":1,"toString":2,"hasOwnProperty":3,"__proto__":4}'),
        }),
      ],
      [
        "a union branch whose pipe input merges a conflicting intersection",
        z.union([
          z.any(),
          z.object({
            items: z
              .array(
                z.object({ a: z.string().transform((value) => `${value}!`) }).and(z.object({ a: z.string() }))
              )
              .pipe(z.any()),
          }),
        ]),
        () => ({ items: entries(300, () => ({ a: "x" })) }),
      ],
      [
        "a discriminated union whose discriminator several branches may omit",
        z.discriminatedUnion(
          "kind",
          [
            z.object({ kind: z.literal("a").optional(), x: z.array(z.number()) }),
            z.object({ kind: z.literal("b").optional(), y: z.array(z.number()) }),
          ],
          { unionFallback: true }
        ),
        () => ({ y: entries(300, (index) => index) }),
      ],
      [
        "a loose record over an enum, with extra keys",
        z.looseRecord(z.enum(["k1"]), z.string()),
        () => ({ k1: "ok", ...Object.fromEntries(entries(300, (index) => [`x${index}`, "ok"])) }),
      ],
      [
        "an exhaustive record over a literal union",
        z.record(z.union([z.literal("a"), z.literal("b")]), z.array(z.number())),
        () => ({ a: entries(150, (index) => index), b: entries(150, (index) => index) }),
      ],
      [
        "a record with a `__proto__` key Zod skips",
        z.record(z.string(), z.string()),
        () => ({
          ...(JSON.parse('{"__proto__":1}') as Record<string, unknown>),
          ...Object.fromEntries(entries(300, (index) => [`k${index}`, "x"])),
        }),
      ],
      [
        "a catchall object with a `__proto__` key Zod skips",
        z.object({}).catchall(z.string()),
        () => ({
          ...(JSON.parse('{"__proto__":1}') as Record<string, unknown>),
          ...Object.fromEntries(entries(300, (index) => [`k${index}`, "x"])),
        }),
      ],
      [
        "a shape that declares a `__proto__` key",
        z.object({ ["__proto__"]: z.string(), pad: z.array(z.number()) }),
        () => ({ ...(JSON.parse('{"__proto__":1}') as Record<string, unknown>), ...padding }),
      ],
      ["a value that contains itself", withPad({ a: z.string() }), cyclic],
      ["a value that contains itself, under a recursive schema", loop, looped],
    ])("%s", (_name, schema, build) => {
      expect(boundedSchema(schema).safeParse(build()).success).toBe(schema.safeParse(build()).success);
    });
  });

  // A field wrapper (exactOptional) and a codec's input side are split like anything else, not parsed
  // whole with a big value under them.
  test.each<[string, (inner: z.ZodType) => z.ZodType]>([
    ["exactOptional", (inner) => z.object({ list: inner.exactOptional() })],
    [
      "a codec's input side",
      (inner) =>
        z.object({
          list: z.codec(inner, z.array(z.string()), {
            decode: (value) => value as string[],
            encode: (value) => value,
          }),
        }),
    ],
  ])("stops checking a big value under %s at the cap", (_name, build) => {
    let checks = 0;
    const leaf = z.string().superRefine((_value, ctx) => {
      checks += 1;
      ctx.addIssue({ code: "custom", message: "bad" });
    });

    const issues = issuesOf(
      boundedSchema(build(z.array(leaf))).safeParse({ list: entries(5000, () => "x") })
    );

    expect(issues).toHaveLength(V3_INVALID_PARAMS_MAX);
    expect(checks).toBeLessThan(500);
  });

  // An absent discriminator is judged by its absence: checked as `undefined`, an exactOptional one
  // matched no branch and the union was parsed whole.
  test("splits a discriminated union whose exactOptional discriminator is absent", () => {
    let checks = 0;
    const leaf = z.string().superRefine((_value, ctx) => {
      checks += 1;
      ctx.addIssue({ code: "custom", message: "bad" });
    });
    const schema = z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("a").exactOptional(), items: z.array(leaf) }),
      z.object({ kind: z.literal("b"), other: z.string() }),
    ]);

    const issues = issuesOf(boundedSchema(schema).safeParse({ items: entries(5000, () => "x") }));

    expect(issues).toHaveLength(V3_INVALID_PARAMS_MAX);
    expect(checks).toBeLessThan(500);
  });

  // Zod reads an absent key through `in`, so a field's absence verdict depends on its key: one schema
  // used under `constructor` must not decide it for the same schema under another key.
  test("judges a field's absence per key", () => {
    const shared = z.literal("a").exactOptional();
    const pad = { pad: entries(300, (index) => index) };
    const first = z.object({ constructor: shared, pad: z.array(z.number()) });
    const union = z.union([
      z.object({ kind: shared, list: z.array(z.number()) }),
      z.object({ other: z.string(), list: z.array(z.number()) }),
    ]);

    boundedSchema(first).safeParse(pad);
    const value = { list: entries(300, (index) => index) };

    expect(boundedSchema(union).safeParse(value).success).toBe(union.safeParse(value).success);
  });

  // Checked alone, a subtree can reach an intersection merge the whole parse never would, and Zod throws
  // on a conflicting merge; the guard reports that as a problem instead of a 500.
  test("reports a conflicting intersection merge instead of throwing", () => {
    const conflict = z
      .object({ a: z.string().transform((value) => `${value}!`) })
      .and(z.object({ a: z.string() }));
    const schema = z.object({ items: z.array(z.object({ c: conflict })) });

    const result = boundedSchema(schema).safeParse({ items: entries(300, () => ({ c: { a: "x" } })) });

    expect(result.success).toBe(false);
  });

  // A big intersection at a pipe's input: each side passes on its own, and only parsing the input to feed
  // the output side reaches the merge, which Zod throws on.
  test("reports a conflicting merge at a pipe's input instead of throwing", () => {
    const schema = z.object({
      x: z
        .array(z.number().transform((value) => value + 1))
        .and(z.array(z.number()))
        .pipe(z.any()),
    });

    const result = boundedSchema(schema).safeParse({ x: entries(300, (index) => index) });

    expect(result.success).toBe(false);
  });

  // A refused key is judged on its own: the big value under it is not parsed whole.
  test("walks the value under a refused key instead of parsing it whole", () => {
    let checks = 0;
    const leaf = z.string().superRefine((_value, ctx) => {
      checks += 1;
      ctx.addIssue({ code: "custom", message: "bad" });
    });
    const schema = z.record(z.enum(["a"]), z.array(leaf));

    const issues = issuesOf(boundedSchema(schema).safeParse({ b: entries(5000, () => "x") }));

    expect(issues.length).toBeGreaterThan(0);
    expect(checks).toBe(0);
  });

  test("keeps the schema's output side for JSON Schema generation", () => {
    const schema = z.object({ items: z.array(item).max(5) });

    expect(z.toJSONSchema(boundedSchema(schema), { io: "output", unrepresentable: "any" })).toMatchObject({
      properties: { items: { type: "array", maxItems: 5 } },
    });
  });
});
