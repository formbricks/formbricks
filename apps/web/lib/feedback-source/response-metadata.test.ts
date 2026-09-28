import { describe, expect, test, vi } from "vitest";
import type { TEmbeddedValueResponse, TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  HUB_METADATA_FIELDS,
  type TMetadataContext,
  buildEmbeddedDataMetadata,
  buildResponseMetadata,
  projectMetadataFields,
  stripUrlQuery,
} from "./response-metadata";

vi.mock("@formbricks/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

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
    // `user:pass@host` parses as a URL whose protocol is `user:`, so it dodges the origin branch —
    // the fallback has to drop the credentials itself.
    ["scheme-less credentials", "user:pass@app.example.com/p?token=1", "app.example.com/p"],
    ["credentials on a custom scheme", "myapp://u:p@host/x?t=1", "myapp://host/x"],
    // A network-path reference: new URL() rejects it without a base, so only the fallback can
    // strip these — and its userinfo cut has to see past the leading slashes.
    ["credentials on a protocol-relative url", "//user:pass@host/path?token=1", "//host/path"],
    ["credentials with nothing after them", "user:pass@", undefined],
  ])("drops userinfo the origin branch never saw (%s)", (_label, input, expected) => {
    expect(stripUrlQuery(input)).toBe(expected);
  });

  test.each([
    // The personal-link token is the credential itself, and stripping the query does not touch it.
    ["personal link", "https://app.example.com/c/eyJhbGci.tok.sig?foo=1", "https://app.example.com/c"],
    ["personal link, no query", "https://app.example.com/c/eyJhbGci.tok.sig", "https://app.example.com/c"],
    [
      "an ordinary survey path is untouched",
      "https://app.example.com/s/cm123",
      "https://app.example.com/s/cm123",
    ],
    // The fallback shape: never produced by the SDK (which sends an absolute href), but `meta.url`
    // is client-supplied, so the helper's contract has to hold on this path too.
    ["protocol-relative personal link", "//app.example.com/c/eyJhbGci.tok.sig?foo=1", "//app.example.com/c"],
    ["scheme-less personal link", "app.example.com/c/eyJhbGci.tok.sig", "app.example.com/c"],
    ["a /c segment that is not the first is left alone", "//host/a/c/keep", "//host/a/c/keep"],
  ])("drops the personal-link token (%s)", (_label, input, expected) => {
    expect(stripUrlQuery(input)).toBe(expected);
  });

  test("drops userinfo up to the last @, not the first", () => {
    // Cutting at the first `@` would publish the tail of the password.
    expect(stripUrlQuery("//user:p@ss@host/path?token=1")).toBe("//host/path");
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
      buildResponseMetadata(
        buildResponse({
          meta: fullMeta,
          finished: true,
          ttc: { _total: 45_500 },
          endingId: "ending-1",
        }),
        { type: "app" }
      )
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
      ending_id: "ending-1",
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

  describe("values the column can hold but the type does not describe", () => {
    // Response.meta is a Prisma `Json` column and stored rows are never re-validated on read, so
    // these shapes are reachable in production even though TResponseMeta forbids them. A throw here
    // aborts the whole transform and the caller's catch drops the response's records silently.
    test("treats a null value as absent", () => {
      const result = buildResponseMetadata(
        buildResponse({ meta: { source: "link", action: null } as never }),
        linkSurvey
      );

      expect(result).not.toHaveProperty("action");
      expect(result.source).toBe("link");
    });

    test("drops a value that is not a scalar, and passes a stray scalar through", () => {
      const result = buildResponseMetadata(
        buildResponse({ meta: { source: 42, url: { nested: true }, country: ["PT"] } as never }),
        linkSurvey
      );

      // A number is a legal JSONB scalar, so publishing it loses nothing; an object or array is
      // what the metadata contract cannot carry.
      expect(result.source).toBe(42);
      expect(result).not.toHaveProperty("url");
      expect(result).not.toHaveProperty("country");
    });

    test("survives a meta object that is null outright", () => {
      expect(() => buildResponseMetadata(buildResponse({ meta: null as never }), linkSurvey)).not.toThrow();
    });
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

    test("never cuts a surrogate pair in half", () => {
      // 255 single-unit characters plus one emoji is 257 UTF-16 code units, so the 256 cap lands
      // between the emoji's two halves.
      const result = buildResponseMetadata(
        buildResponse({ meta: { source: `${"a".repeat(255)}\u{1F600}` } }),
        linkSurvey
      );

      expect(result.source).toHaveLength(255);
      // A lone surrogate is rejected on the jsonb insert just like a NUL byte, so the whole
      // submission's records would never be published.
      expect(String(result.source)).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    });

    test("keeps a multi-byte character that fits within the cap", () => {
      expect(
        buildResponseMetadata(buildResponse({ meta: { source: "feedback \u{1F600}" } }), linkSurvey).source
      ).toBe("feedback \u{1F600}");
    });

    test("does not leave trailing whitespace where the cut landed", () => {
      expect(
        buildResponseMetadata(buildResponse({ meta: { source: `${"a".repeat(255)} tail` } }), linkSurvey)
          .source
      ).toBe("a".repeat(255));
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

    test("publishes a duration of exactly seven days", () => {
      // The cap is inclusive: a week is a plausible longest-lived link-survey tab, noise starts
      // beyond it.
      expect(
        buildResponseMetadata(buildResponse({ ttc: { _total: 7 * 24 * 60 * 60 * 1000 } }), linkSurvey)
          .duration_seconds
      ).toBe(604_800);
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

describe("HUB_METADATA_FIELDS", () => {
  test("publishes exactly the reviewed allowlist", () => {
    // Adding a field to the catalog is a privacy decision (see the module comment), so it has to be
    // made here too. `ipAddress` is absent by construction and must stay absent.
    expect(HUB_METADATA_FIELDS.filter((field) => field.enabled).map((field) => field.key)).toEqual([
      "source",
      "url",
      "browser",
      "os",
      "device",
      "country",
      "action",
      "finished",
      "duration_seconds",
      "ending_id",
      "survey_type",
    ]);
  });

  test("names every field in snake_case, as Hub metadata keys are conventionally written", () => {
    const offenders = HUB_METADATA_FIELDS.filter((field) => !/^[a-z][a-z0-9_]*$/.test(field.key));
    expect(offenders.map((field) => field.key)).toEqual([]);
  });
});

describe("projectMetadataFields", () => {
  test("skips a field that has been withdrawn", () => {
    // Driven through an ad-hoc table rather than by mutating HUB_METADATA_FIELDS, which other callers
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

/**
 * The three hazards below all come from `field.name` being any non-blank string (`ZEmbeddedDataName`
 * refines nothing else), so they are proven here against the builder directly rather than through a
 * survey response: each one is invisible in an end-to-end assertion, and each removes itself
 * silently if the guard goes.
 */
describe("buildEmbeddedDataMetadata", () => {
  const field = (name: string, source: "ingested" | "computed", storageKey = name): TLinkedEmbeddedField => ({
    field: { key: null, name, source, dataType: "string", defaultValue: null, locked: false },
    link: { storageKey },
  });

  const ingested = (name: string, storageKey = name) => field(name, "ingested", storageKey);

  const responseWithData = (
    data: Record<string, string>,
    variables: Record<string, string> = {}
  ): TEmbeddedValueResponse =>
    ({
      id: "response-1",
      surveyId: "survey-1",
      createdAt: new Date("2026-02-24T10:00:00.000Z"),
      updatedAt: new Date("2026-02-24T10:00:00.000Z"),
      finished: true,
      language: "default",
      data,
      variables,
      ttc: {},
      meta: {},
    }) as unknown as TEmbeddedValueResponse;

  test("keeps the first of two fields of the same source sharing a name", () => {
    // Nothing stops a survey declaring the same name twice, and letting the later one win would
    // make the published value depend on the response rather than on the survey.
    const survey = {
      embeddedFields: [ingested("brand", "brand_a"), ingested("brand", "brand_b")],
    };

    expect(
      buildEmbeddedDataMetadata(responseWithData({ brand_a: "AEG", brand_b: "Electrolux" }), survey)
    ).toEqual({ brand: "AEG" });
  });

  test("lets an ingested field win a name it shares with a computed one, whichever is declared first", () => {
    // The field list is every ingested field followed by every computed one, so source decides
    // before declaration order does — and a survey that lists the computed one first does not
    // change that. Documented as the rule because it is what the concatenation guarantees.
    const survey = {
      embeddedFields: [field("plan", "computed", "var-plan"), ingested("plan", "plan_param")],
    };

    expect(
      buildEmbeddedDataMetadata(responseWithData({ plan_param: "pro" }, { "var-plan": "calculated" }), survey)
    ).toEqual({ plan: "pro" });
  });

  test("strips NUL bytes and surrounding space from the published key", () => {
    // A NUL reaching the jsonb insert fails as a 500 rather than a rejected field, which costs the
    // response every one of its records; an untrimmed name would be a second Hub dimension.
    const survey = { embeddedFields: [ingested("a\u0000b", "key-nul"), ingested("  plan  ", "key-pad")] };

    expect(buildEmbeddedDataMetadata(responseWithData({ "key-nul": "x", "key-pad": "pro" }), survey)).toEqual(
      { ab: "x", plan: "pro" }
    );
  });

  test("publishes a field named __proto__ as an own key, not as the object's prototype", () => {
    const survey = { embeddedFields: [ingested("__proto__", "key-proto")] };

    const result = buildEmbeddedDataMetadata(responseWithData({ "key-proto": "AEG" }), survey);

    // Assigning this name onto an object literal reaches the prototype setter, so the field would
    // vanish from the published object while every other assertion still passed.
    expect(Object.hasOwn(result, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });
});
