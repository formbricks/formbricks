import { describe, expect, test } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  METADATA_FIELDS,
  type TMetadataContext,
  buildResponseMetadata,
  projectMetadataFields,
  stripUrlQuery,
} from "./response-metadata";

type TMetadataResponse = TMetadataContext["response"];

const buildResponse = (overrides: Partial<TMetadataResponse> = {}): TMetadataResponse => ({
  meta: {},
  finished: true,
  ttc: {},
  ...overrides,
});

const linkSurvey: Pick<TSurvey, "type"> = { type: "link" };

const fullMeta = {
  source: "link",
  url: "https://app.example.com/s/abc?token=secret&utm_source=newsletter#question-2",
  userAgent: { browser: "Chrome", os: "macOS", device: "desktop" },
  country: "PT",
  action: "Clicked pricing CTA",
  // Present on every IP-capturing survey's response and must never be published.
  ipAddress: "203.0.113.7",
};

describe("stripUrlQuery", () => {
  test("reduces an absolute url to origin and path", () => {
    expect(stripUrlQuery("https://app.example.com/s/abc?token=secret#question-2")).toBe(
      "https://app.example.com/s/abc"
    );
  });

  test("leaves a url that carries no query or fragment untouched", () => {
    expect(stripUrlQuery("https://app.example.com/pricing")).toBe("https://app.example.com/pricing");
  });

  test("drops embedded credentials", () => {
    expect(stripUrlQuery("https://user:pass@app.example.com/s/abc")).toBe("https://app.example.com/s/abc");
  });

  test("cuts the query off a value that is not an absolute url", () => {
    // The scheme-less form cannot be parsed, and passing it through would leak the token this
    // helper exists to remove.
    expect(stripUrlQuery("app.example.com/s/abc?token=secret")).toBe("app.example.com/s/abc");
  });

  test("cuts the query off a non-web scheme", () => {
    expect(stripUrlQuery("myapp://survey/abc?token=secret")).toBe("myapp://survey/abc");
  });

  test.each([
    ["empty", ""],
    ["whitespace", "   "],
    ["query only", "?token=secret"],
  ])("returns undefined for a %s value", (_label, input) => {
    expect(stripUrlQuery(input)).toBeUndefined();
  });
});

describe("buildResponseMetadata", () => {
  test("publishes the full response and survey context", () => {
    // Asserted with toEqual, not toMatchObject: this is the published payload, so a newly added
    // key has to be seen and decided on here rather than shipping unnoticed.
    expect(
      buildResponseMetadata(buildResponse({ meta: fullMeta, finished: true, ttc: { _total: 45_500 } }), {
        type: "app",
      })
    ).toEqual({
      source: "link",
      url: "https://app.example.com/s/abc",
      browser: "Chrome",
      os: "macOS",
      device: "desktop",
      country: "PT",
      action: "Clicked pricing CTA",
      finished: true,
      duration_seconds: 46,
      survey_type: "app",
    });
  });

  test("never publishes the respondent's IP address", () => {
    const result = buildResponseMetadata(buildResponse({ meta: fullMeta }), linkSurvey);

    expect(Object.keys(result)).not.toContain("ipAddress");
    expect(Object.keys(result)).not.toContain("ip_address");
    expect(Object.values(result)).not.toContain(fullMeta.ipAddress);
  });

  test("falls back to row context when the response carries no meta", () => {
    // meta defaults to {} in Prisma, so this is the shape of a link response with no tracking.
    expect(buildResponseMetadata(buildResponse({ meta: {} }), linkSurvey)).toEqual({
      finished: true,
      survey_type: "link",
    });
  });

  test("omits blank values instead of publishing empty keys", () => {
    expect(
      buildResponseMetadata(
        buildResponse({
          meta: {
            source: "",
            url: "",
            country: "   ",
            action: "",
            userAgent: { browser: "", os: "", device: "" },
          },
        }),
        linkSurvey
      )
    ).toEqual({ finished: true, survey_type: "link" });
  });

  test("returns nothing for a row that carries no context at all", () => {
    // Legacy rows predate several of these fields; the transform relies on an empty result to omit
    // the metadata key entirely rather than storing {}.
    const result = buildResponseMetadata(
      { meta: undefined, finished: undefined, ttc: undefined } as unknown as TMetadataResponse,
      {} as Pick<TSurvey, "type">
    );

    expect(result).toEqual({});
  });

  describe("bounds", () => {
    test("truncates oversized values so an inflated meta cannot fail the Hub create", () => {
      const result = buildResponseMetadata(
        buildResponse({
          meta: {
            source: "s".repeat(400),
            url: `https://app.example.com/${"p".repeat(900)}`,
          },
        }),
        linkSurvey
      );

      expect(result.source).toHaveLength(256);
      expect(result.url).toHaveLength(512);
    });

    test("strips NUL bytes, which Hub cannot store", () => {
      expect(
        buildResponseMetadata(buildResponse({ meta: { source: "li\u0000nk" } }), linkSurvey).source
      ).toBe("link");
    });

    test("omits a value that is nothing but NUL bytes", () => {
      expect(
        buildResponseMetadata(buildResponse({ meta: { source: "\u0000" } }), linkSurvey)
      ).not.toHaveProperty("source");
    });
  });

  describe("duration_seconds", () => {
    test("converts the total time-to-complete from milliseconds", () => {
      expect(
        buildResponseMetadata(buildResponse({ ttc: { _total: 45_500 } }), linkSurvey).duration_seconds
      ).toBe(46);
    });

    test("publishes a zero duration", () => {
      // Zero is a measurement, not a missing value — an omit-on-falsy check would drop it.
      expect(buildResponseMetadata(buildResponse({ ttc: { _total: 0 } }), linkSurvey).duration_seconds).toBe(
        0
      );
    });

    test.each([
      ["no _total key", {}],
      ["a negative total", { _total: -1 }],
      ["a non-finite total", { _total: Number.NaN }],
      ["a total beyond a week", { _total: 8 * 24 * 60 * 60 * 1000 }],
    ])("omits the duration for %s", (_label, ttc) => {
      expect(buildResponseMetadata(buildResponse({ ttc }), linkSurvey)).not.toHaveProperty(
        "duration_seconds"
      );
    });
  });
});

describe("METADATA_FIELDS", () => {
  test("publishes exactly the reviewed allowlist", () => {
    // Adding a field to the catalog is a privacy decision (see the module comment), so it has to be
    // made here too. `ipAddress` is absent by construction and must stay absent.
    expect(METADATA_FIELDS.filter((field) => field.enabled).map((field) => field.key)).toEqual([
      "source",
      "url",
      "browser",
      "os",
      "device",
      "country",
      "action",
      "finished",
      "duration_seconds",
      "survey_type",
    ]);
  });

  test("names every field in snake_case, as Hub metadata keys are conventionally written", () => {
    const offenders = METADATA_FIELDS.filter((field) => !/^[a-z][a-z0-9_]*$/.test(field.key));
    expect(offenders.map((field) => field.key)).toEqual([]);
  });
});

describe("projectMetadataFields", () => {
  test("skips a field that has been withdrawn", () => {
    // Driven through an ad-hoc table rather than by mutating METADATA_FIELDS, which other callers
    // share: the point is that flipping `enabled` is all it takes to stop publishing a field.
    const result = projectMetadataFields(
      [
        { key: "kept", enabled: true, read: () => "published" },
        { key: "withdrawn", enabled: false, read: () => "should not appear" },
      ],
      { response: buildResponse(), survey: linkSurvey }
    );

    expect(result).toEqual({ kept: "published" });
  });

  test("applies a field's own maxLength ahead of the default", () => {
    const result = projectMetadataFields(
      [{ key: "roomy", enabled: true, maxLength: 400, read: () => "x".repeat(500) }],
      { response: buildResponse(), survey: linkSurvey }
    );

    expect(result.roomy).toHaveLength(400);
  });
});
