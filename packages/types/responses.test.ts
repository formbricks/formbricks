import { describe, expect, test } from "vitest";
import {
  MAX_RESPONSE_DATA_ENTRIES,
  MAX_RESPONSE_DATA_KEYS,
  MAX_RESPONSE_DATA_VALUES,
  ZResponseFilterCriteria,
  ZResponseInput,
  ZResponseMeta,
  ZResponseUpdate,
  ZResponseUpdateInput,
  pickAutoCapturedResponseMeta,
} from "./responses";

/** Everything the renderer snapshots at display time, in one object (ENG-1841). */
const fullAutoCapturedMeta = {
  pagePath: "/checkout",
  pageReferrer: "https://news.example.org/weekly",
  utmSource: "news",
  utmMedium: "email",
  utmCampaign: "august-launch",
  utmTerm: "checkout",
  utmContent: "hero-cta",
  screenWidth: 2560,
  screenHeight: 1440,
  viewportWidth: 1280,
  viewportHeight: 800,
  timezone: "Europe/Berlin",
  locale: "de-AT",
};

describe("ZResponseMeta", () => {
  test("accepts a full new-shape meta, server-derived parts included", () => {
    const meta = {
      ...fullAutoCapturedMeta,
      source: "app",
      url: "https://shop.example.com/checkout",
      userAgent: { browser: "Chrome", os: "macOS", device: "desktop" },
      country: "DE",
      action: "Clicked Checkout",
      ipAddress: "203.0.113.7",
    };

    expect(ZResponseMeta.parse(meta)).toStrictEqual(meta);
  });

  test("still accepts a legacy `{ source, url }` meta", () => {
    // The whole no-migration story. Every response collected before this shipped carries only what
    // was captured then, and must keep validating unchanged — there is nothing to backfill, because
    // the values only ever existed in a browser that has long since closed.
    expect(ZResponseMeta.parse({ source: "link", url: "https://example.com/old" })).toStrictEqual({
      source: "link",
      url: "https://example.com/old",
    });
  });

  test("accepts an entirely empty meta", () => {
    expect(ZResponseMeta.parse({})).toStrictEqual({});
  });

  test("rejects a screen dimension sent as a string", () => {
    // The four dimensions are numbers so logic can compare them arithmetically; a digit string would
    // compare lexicographically ("900" > "1280") and quietly give the wrong branch.
    expect(ZResponseMeta.safeParse({ viewportWidth: "1280" }).success).toBe(false);
  });
});

describe("ZResponseInput.meta", () => {
  test("parses the auto-captured keys instead of stripping them at the boundary", () => {
    const parsed = ZResponseInput.parse({
      workspaceId: "clx0000000000000000000w1",
      surveyId: "clx0000000000000000000s2",
      finished: false,
      data: {},
      meta: fullAutoCapturedMeta,
    });

    expect(parsed.meta).toStrictEqual(fullAutoCapturedMeta);
  });

  test("drops keys nobody declared", () => {
    const parsed = ZResponseInput.parse({
      workspaceId: "clx0000000000000000000w1",
      surveyId: "clx0000000000000000000s2",
      finished: false,
      data: {},
      meta: { pagePath: "/checkout", sessionCookie: "s3cr3t", visitorType: "returning" },
    });

    expect(parsed.meta).toStrictEqual({ pagePath: "/checkout" });
  });

  test("drops an openedByCreativeId that isn't text instead of refusing the response", () => {
    // The ingest routes keep the attribution only after checking it; a malformed one from any client
    // must cost the attribution, never the answer.
    const parsed = ZResponseInput.safeParse({
      workspaceId: "clx0000000000000000000w1",
      surveyId: "clx0000000000000000000s2",
      finished: false,
      data: {},
      meta: { pagePath: "/checkout", openedByCreativeId: 42 },
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.meta?.pagePath).toBe("/checkout");
    expect(parsed.data?.meta?.openedByCreativeId).toBeUndefined();
  });
});

describe("ZResponseUpdate.meta", () => {
  test("carries the auto-captured keys from the renderer into the queue", () => {
    const parsed = ZResponseUpdate.parse({
      finished: true,
      data: {},
      meta: { ...fullAutoCapturedMeta, url: "https://shop.example.com/checkout", source: "app" },
    });

    expect(parsed.meta).toMatchObject(fullAutoCapturedMeta);
  });

  test("strips the server-derived keys a renderer has no business claiming", () => {
    // `country`, `userAgent` and `ipAddress` are derived from the request by the ingest routes. A
    // client asserting them would be asserting something it cannot know.
    const parsed = ZResponseUpdate.parse({
      finished: true,
      data: {},
      meta: {
        pagePath: "/checkout",
        country: "XX",
        ipAddress: "203.0.113.7",
        userAgent: { browser: "Chrome" },
      },
    });

    expect(parsed.meta).toStrictEqual({ pagePath: "/checkout" });
  });
});

describe("pickAutoCapturedResponseMeta", () => {
  test("keeps exactly the auto-captured keys and nothing else", () => {
    // This is what the two client ingest routes spread into their rebuilt `meta`. If it ever let a
    // server-derived key through, a public caller could set its own `country` or `ipAddress`.
    expect(
      pickAutoCapturedResponseMeta({
        ...fullAutoCapturedMeta,
        source: "app",
        url: "https://shop.example.com/checkout",
        country: "XX",
        ipAddress: "203.0.113.7",
        userAgent: { browser: "Chrome", os: "macOS", device: "desktop" },
        action: "Clicked Checkout",
      })
    ).toStrictEqual(fullAutoCapturedMeta);
  });

  test("returns an empty object for a response that captured nothing", () => {
    expect(pickAutoCapturedResponseMeta(undefined)).toStrictEqual({});
    expect(pickAutoCapturedResponseMeta({})).toStrictEqual({});
  });

  test("omits absent keys rather than emitting them as undefined", () => {
    // Spread into the route's `meta` literal, an explicit `pagePath: undefined` would still create
    // the key and land in the JSON column as a null.
    const picked = pickAutoCapturedResponseMeta({ pagePath: "/checkout" });

    expect(Object.keys(picked)).toStrictEqual(["pagePath"]);
  });
});

describe("ZResponseFilterCriteria.data", () => {
  const parse = (value: unknown) => ZResponseFilterCriteria.safeParse({ data: { is_pro: value } });

  test.each(["equals", "notEquals"] as const)("rejects a jsonb boolean under %s", (op) => {
    expect(parse({ op, value: true }).success).toBe(false);
    expect(parse({ op, value: "true" }).success).toBe(true);
  });
});

describe("response input caps", () => {
  const keyed = <T>(count: number, value: (index: number) => T): Record<string, T> =>
    Object.fromEntries(Array.from({ length: count }, (_, index) => [`k${index}`, value(index)]));
  const strings = (count: number) => Array.from({ length: count }, (_, index) => `choice-${index}`);
  const create = (over: Record<string, unknown>) =>
    ZResponseInput.safeParse({
      workspaceId: "clx0000000000000000000w1",
      surveyId: "clx0000000000000000000s2",
      finished: true,
      data: {},
      ...over,
    });
  const issuesOf = (result: ReturnType<typeof create>) => (result.success ? [] : result.error.issues);

  test("accepts a response at every cap at once", () => {
    // 500 answers: a multi-select with every one of 1,000 choices ticked, a 1,000-row matrix, and
    // enough 15-item arrays to land exactly on the entry budget.
    const fillerKeys = MAX_RESPONSE_DATA_KEYS - 2;
    const fillerItems = MAX_RESPONSE_DATA_ENTRIES - MAX_RESPONSE_DATA_KEYS - 2 * MAX_RESPONSE_DATA_VALUES;
    const data: Record<string, unknown> = keyed(fillerKeys, (index) =>
      strings(Math.floor(fillerItems / fillerKeys) + (index < fillerItems % fillerKeys ? 1 : 0))
    );
    data.multi = strings(MAX_RESPONSE_DATA_VALUES);
    data.matrix = keyed(MAX_RESPONSE_DATA_VALUES, () => "column");

    const result = create({
      data,
      variables: keyed(MAX_RESPONSE_DATA_KEYS, (index) => index),
      ttc: keyed(MAX_RESPONSE_DATA_KEYS, () => 1200),
    });

    expect(issuesOf(result)).toEqual([]);
  });

  // The path says which check caught it: `.max()` on the array itself, or the size check on the map.
  test.each([
    ["an array one past its cap", { q: strings(MAX_RESPONSE_DATA_VALUES + 1) }, ["data", "q"]],
    ["an array of a million invalid items", { q: Array.from({ length: 1_000_000 }, () => 1) }, ["data"]],
    ["a matrix one row past its cap", { q: keyed(MAX_RESPONSE_DATA_VALUES + 1, () => "column") }, ["data"]],
    ["one key past the cap", keyed(MAX_RESPONSE_DATA_KEYS + 1, () => "answer"), ["data"]],
    ["a hundred thousand keys", keyed(100_000, () => true), ["data"]],
    // Each array is within its own cap; the whole map is not.
    [
      "every key at its array cap, every item invalid",
      keyed(MAX_RESPONSE_DATA_KEYS, () => Array.from({ length: MAX_RESPONSE_DATA_VALUES }, () => 1)),
      ["data"],
    ],
  ])("rejects data with %s in a single issue", (_, data, path) => {
    const issues = issuesOf(create({ data }));

    expect(issues).toHaveLength(1);
    expect(issues[0].path).toEqual(path);
  });

  test("rejects data one entry past the budget, with every key and array within its own cap", () => {
    const perKey = (MAX_RESPONSE_DATA_ENTRIES - MAX_RESPONSE_DATA_KEYS) / MAX_RESPONSE_DATA_KEYS;
    const data: Record<string, unknown> = keyed(MAX_RESPONSE_DATA_KEYS, () => strings(perKey));
    (data.k0 as string[]).push("one-too-many");

    const issues = issuesOf(create({ data }));

    expect(issues).toHaveLength(1);
    expect(issues[0].path).toEqual(["data"]);
  });

  test.each([
    ["variables", MAX_RESPONSE_DATA_KEYS + 1],
    ["variables", 100_000],
    ["ttc", MAX_RESPONSE_DATA_KEYS + 1],
    ["ttc", 100_000],
  ])("rejects %s with %i keys in a single issue", (field, count) => {
    const issues = issuesOf(create({ [field]: keyed(count, () => "not a number or string") }));

    expect(issues).toHaveLength(1);
    expect(issues[0].path).toEqual([field]);
  });

  test("bounds the update input the same way", () => {
    const update = (data: unknown) => ZResponseUpdateInput.safeParse({ data });

    expect(update({ q: strings(MAX_RESPONSE_DATA_VALUES) }).success).toBe(true);
    const over = update({ q: Array.from({ length: 1_000_000 }, () => 1) });
    expect(over.success ? [] : over.error.issues).toHaveLength(1);
  });

  test("still reports a data value of the wrong shape where it is", () => {
    const issues = issuesOf(create({ data: { q: true } }));

    expect(issues).toHaveLength(1);
    expect(issues[0].path).toEqual(["data", "q"]);
  });
});
