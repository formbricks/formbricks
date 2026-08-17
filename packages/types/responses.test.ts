import { describe, expect, test } from "vitest";
import { ZResponseInput, ZResponseMeta, ZResponseUpdate, pickAutoCapturedResponseMeta } from "./responses";

/** Everything the renderer snapshots at display time, in one object (ENG-1841). */
const fullAutoCapturedMeta = {
  pageUrl: "https://shop.example.com/checkout?utm_source=news&token=abc123",
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
    // Spread into the route's `meta` literal, an explicit `pageUrl: undefined` would still create
    // the key and land in the JSON column as a null.
    const picked = pickAutoCapturedResponseMeta({ pagePath: "/checkout" });

    expect(Object.keys(picked)).toStrictEqual(["pagePath"]);
  });
});
