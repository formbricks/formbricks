import { describe, expect, test } from "vitest";
import { ISO_COUNTRY_CODES } from "./country-codes";
import {
  MAX_RESPONSE_DATA_ENTRIES,
  MAX_RESPONSE_DATA_KEYS,
  MAX_RESPONSE_DATA_VALUES,
  MAX_RESPONSE_VARIABLE_KEYS,
  RESPONSE_DATA_LIMIT_MESSAGES,
  ZClientResponseInput,
  ZClientResponseUpdateInput,
  ZResponseFilterCriteria,
  ZResponseFilterCriteriaFromJson,
  ZResponseInput,
  ZResponseMeta,
  ZResponseUpdate,
  ZResponseUpdateInput,
  checkResponseDataSize,
  normalizeCountryCode,
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
    // `userAgent` and `ipAddress` are derived from the request by the ingest routes. A client
    // asserting them would be asserting something it cannot know.
    const parsed = ZResponseUpdate.parse({
      finished: true,
      data: {},
      meta: {
        pagePath: "/checkout",
        ipAddress: "203.0.113.7",
        userAgent: { browser: "Chrome" },
      },
    });

    expect(parsed.meta).toStrictEqual({ pagePath: "/checkout" });
  });

  test("keeps `country`: the host may set it, and the ingest routes check it", () => {
    // `?country=` or `setEmbeddedData({ country })`, carried as `meta.country`. The routes keep only a
    // two-letter code and otherwise fall back to the CDN header (`resolveResponseCountry`).
    const parsed = ZResponseUpdate.parse({ finished: true, data: {}, meta: { country: "DE" } });

    expect(parsed.meta).toStrictEqual({ country: "DE" });
  });
});

describe("variables: a true/false field set by Set value (ENG-6973)", () => {
  const variables = { qualified00000000000001: true, rejected000000000000001: false };

  test("the client create and update inputs keep real booleans", () => {
    const created = ZClientResponseInput.parse({
      workspaceId: "clx0000000000000000000w1",
      surveyId: "clx0000000000000000000s2",
      finished: false,
      data: {},
      variables,
    });
    const updated = ZClientResponseUpdateInput.parse({ finished: false, data: {}, variables });

    expect(created.variables).toStrictEqual(variables);
    expect(updated.variables).toStrictEqual(variables);
  });

  test("the stored response keeps them, and still refuses a value of another shape", () => {
    expect(ZResponseUpdate.parse({ finished: true, data: {}, variables }).variables).toStrictEqual(variables);
    expect(
      ZClientResponseUpdateInput.safeParse({ finished: false, data: {}, variables: { a: null } }).success
    ).toBe(false);
  });
});

describe("variables: a date field set by now() (ENG-6935)", () => {
  // The renderer stores now() as a full UTC timestamp. No boundary may read a date variable as a
  // calendar day and refuse or cut the time off.
  const variables = { checkedinat0000000000001: "2026-11-04T10:12:30.000Z" };

  test("the client create and update inputs keep the timestamp as sent", () => {
    const created = ZClientResponseInput.parse({
      workspaceId: "clx0000000000000000000w1",
      surveyId: "clx0000000000000000000s2",
      finished: false,
      data: {},
      variables,
    });
    const updated = ZClientResponseUpdateInput.parse({ finished: false, data: {}, variables });

    expect(created.variables).toStrictEqual(variables);
    expect(updated.variables).toStrictEqual(variables);
  });

  test("the stored response keeps it too", () => {
    expect(ZResponseUpdate.parse({ finished: true, data: {}, variables }).variables).toStrictEqual(variables);
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

describe("ZResponseFilterCriteriaFromJson", () => {
  const min = new Date("2026-11-06T00:00:00.000Z");
  const max = new Date("2026-11-10T23:59:59.999Z");
  const overJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

  test("takes back the Created at range a JSON round trip turned into ISO text", () => {
    const filter = { finished: true, createdAt: { min, max } };

    expect(ZResponseFilterCriteria.safeParse(overJson(filter)).success).toBe(false);
    expect(ZResponseFilterCriteriaFromJson.parse(overJson(filter))).toEqual(filter);
  });

  test("keeps a one-sided range one-sided", () => {
    expect(ZResponseFilterCriteriaFromJson.parse(overJson({ createdAt: { min } }))).toEqual({
      createdAt: { min },
    });
    expect(ZResponseFilterCriteriaFromJson.parse(overJson({ createdAt: { max } }))).toEqual({
      createdAt: { max },
    });
  });

  test("still takes Dates, and a filter without a range, unchanged", () => {
    expect(ZResponseFilterCriteriaFromJson.parse({ createdAt: { min, max } })).toEqual({
      createdAt: { min, max },
    });
    expect(ZResponseFilterCriteriaFromJson.parse({ finished: false })).toEqual({ finished: false });
  });

  test("refuses a bound that is not a date", () => {
    expect(ZResponseFilterCriteriaFromJson.safeParse({ createdAt: { min: "not a date" } }).success).toBe(
      false
    );
    expect(ZResponseFilterCriteriaFromJson.safeParse({ createdAt: { max: 42 } }).success).toBe(false);
    expect(ZResponseFilterCriteriaFromJson.safeParse({ createdAt: "2026-11-06" }).success).toBe(false);
    expect(ZResponseFilterCriteriaFromJson.safeParse({ createdAt: [] }).success).toBe(false);
    expect(
      ZResponseFilterCriteriaFromJson.safeParse({ createdAt: ["2026-11-06T00:00:00.000Z"] }).success
    ).toBe(false);
  });
});

describe("ZResponseFilterCriteria.statuses", () => {
  const parse = (statuses: unknown) => ZResponseFilterCriteria.safeParse({ statuses });

  test("takes no more statuses than the quick filter offers", () => {
    expect(parse(["complete", "lowQuality"]).success).toBe(true);
    expect(parse(["complete", "partial", "lowQuality"]).success).toBe(true);
    expect(parse(["complete", "partial", "lowQuality", "complete"]).success).toBe(false);
  });

  test("rejects a status the quick filter does not offer", () => {
    expect(parse(["complete", "archived"]).success).toBe(false);
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
    // 2,000 answers: a multi-select with every one of 1,000 choices ticked, a 1,000-row matrix, and
    // 1,998 short arrays that land exactly on the entry budget between them.
    const fillerKeys = MAX_RESPONSE_DATA_KEYS - 2;
    const fillerItems = MAX_RESPONSE_DATA_ENTRIES - MAX_RESPONSE_DATA_KEYS - 2 * MAX_RESPONSE_DATA_VALUES;
    const data: Record<string, unknown> = keyed(fillerKeys, (index) =>
      strings(Math.floor(fillerItems / fillerKeys) + (index < fillerItems % fillerKeys ? 1 : 0))
    );
    data.multi = strings(MAX_RESPONSE_DATA_VALUES);
    data.matrix = keyed(MAX_RESPONSE_DATA_VALUES, () => "column");

    const result = create({
      data,
      variables: keyed(MAX_RESPONSE_VARIABLE_KEYS, (index) => index),
      ttc: keyed(MAX_RESPONSE_DATA_KEYS, () => 1200),
    });

    expect(issuesOf(result)).toEqual([]);
  });

  // Every one is caught by the size check on the map, before Zod reads a single item, and reported at the
  // answer it names when there is one.
  test.each([
    ["an array one past its cap", { q: strings(MAX_RESPONSE_DATA_VALUES + 1) }, ["data", "q"]],
    [
      "an array one past its cap, every item invalid",
      { q: Array.from({ length: MAX_RESPONSE_DATA_VALUES + 1 }, () => 1) },
      ["data", "q"],
    ],
    ["an array of a million invalid items", { q: Array.from({ length: 1_000_000 }, () => 1) }, ["data", "q"]],
    [
      "a matrix one row past its cap",
      { q: keyed(MAX_RESPONSE_DATA_VALUES + 1, () => "column") },
      ["data", "q"],
    ],
    ["one key past the cap", keyed(MAX_RESPONSE_DATA_KEYS + 1, () => "answer"), ["data"]],
    ["a hundred thousand keys", keyed(100_000, () => true), ["data"]],
    [
      "every key at its array cap, every item invalid",
      keyed(MAX_RESPONSE_DATA_KEYS, () => Array.from({ length: MAX_RESPONSE_DATA_VALUES }, () => 1)),
      ["data", "k0"],
    ],
  ])("rejects data with %s in a single issue", (_, data, path) => {
    const issues = issuesOf(create({ data }));

    expect(issues).toHaveLength(1);
    expect(issues[0].path).toEqual(path);
  });

  // Zod would report a wrong item inside the answer union once per item, nested; the pre-check refuses the
  // answer with one plain issue instead.
  test.each([
    ["an array", { q: [1, 2, 3, "ok"] }],
    ["a matrix", { q: { row: 1 } }],
  ])("refuses %s holding non-text items with one issue naming the answer", (_, data) => {
    const issues = issuesOf(create({ data }));

    expect(issues).toEqual([
      expect.objectContaining({
        code: "custom",
        path: ["data", "q"],
        message: RESPONSE_DATA_LIMIT_MESSAGES.text,
      }),
    ]);
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
    ["variables", MAX_RESPONSE_VARIABLE_KEYS + 1],
    ["variables", 100_000],
    ["ttc", MAX_RESPONSE_DATA_KEYS + 1],
    ["ttc", 100_000],
  ])("rejects %s with %i keys in a single issue", (field, count) => {
    const issues = issuesOf(create({ [field]: keyed(count, () => "not a number or string") }));

    expect(issues).toHaveLength(1);
    expect(issues[0].path).toEqual([field]);
  });

  // The budget counts keys as well as items, so it holds whatever the answers are.
  test.each([
    ["scalars", "text"],
    ["empty lists", []],
  ])("an entry budget smaller than the key count refuses a map of %s", (_, value) => {
    expect(
      checkResponseDataSize(
        keyed(3, () => value),
        2
      )
    ).toBe(RESPONSE_DATA_LIMIT_MESSAGES.entries);
    expect(
      checkResponseDataSize(
        keyed(2, () => value),
        2
      )
    ).toBeUndefined();
  });

  test("bounds the update input the same way", () => {
    const update = (data: unknown) => ZResponseUpdateInput.safeParse({ data });

    expect(update({ q: strings(MAX_RESPONSE_DATA_VALUES) }).success).toBe(true);
    const over = update({ q: Array.from({ length: 1_000_000 }, () => 1) });
    expect(over.success ? [] : over.error.issues).toHaveLength(1);
  });

  test("still reports a data value of the wrong shape where it is", () => {
    const issues = issuesOf(create({ data: { q: true } }));

    expect(issues).toEqual([
      expect.objectContaining({ path: ["data", "q"], message: RESPONSE_DATA_LIMIT_MESSAGES.shape }),
    ]);
  });

  // A wrong value is refused at the first one, so a map full of them costs one issue, not one per value.
  test.each([
    ["data", true, ["data", "k0"]],
    ["data", null, ["data", "k0"]],
    ["data", { row: 1 }, ["data", "k0"]],
    ["ttc", "not a number", ["ttc", "k0"]],
    ["variables", null, ["variables", "k0"]],
  ])("refuses %s full of wrong values (%j) with one issue at the first", (field, value, path) => {
    const count = field === "variables" ? MAX_RESPONSE_VARIABLE_KEYS : MAX_RESPONSE_DATA_KEYS;
    const issues = issuesOf(create({ [field]: keyed(count, () => value) }));

    expect(issues).toHaveLength(1);
    expect(issues[0].path).toEqual(path);
  });
});

describe("normalizeCountryCode", () => {
  test("keeps an assigned code, trimmed and upper-cased", () => {
    expect(normalizeCountryCode("DE")).toBe("DE");
    expect(normalizeCountryCode(" us ")).toBe("US");
    expect(normalizeCountryCode("gb")).toBe("GB");
  });

  test("keeps XK, the code Cloudflare reports for Kosovo", () => {
    expect(normalizeCountryCode("xk")).toBe("XK");
  });

  test("holds exactly the 249 ISO 3166-1 codes plus XK", () => {
    expect(ISO_COUNTRY_CODES.size).toBe(250);
    for (const code of ISO_COUNTRY_CODES) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  test("refuses anything else, so the ingest routes fall back to the CDN header", () => {
    for (const value of ["Germany", "D", "DEU", "D1", "", 49, null, undefined, ["DE"]]) {
      expect(normalizeCountryCode(value)).toBeUndefined();
    }
  });

  test("refuses well-formed codes that name no country: unassigned, deprecated, groupings", () => {
    for (const value of ["ZZ", "XX", "QQ", "UK", "SU", "EU", "UN", "T1"]) {
      expect(normalizeCountryCode(value)).toBeUndefined();
    }
  });
});
