import { describe, expect, test, vi } from "vitest";
import {
  RESERVED_FIELD_CATALOG,
  type TReservedFieldCatalogEntry,
  projectReservedValues,
} from "@formbricks/types/embedded-data-resolver";
import { type TResponseMeta } from "@formbricks/types/responses";
import { parseRecallInfo } from "@/lib/utils/recall";
import { applyAnonymizePolicy, redactUrlQueryParams } from "./anonymize";

describe("redactUrlQueryParams", () => {
  test("strips the query string and keeps origin + path", () => {
    expect(redactUrlQueryParams("https://example.com/pricing?token=secret&email=a@b.c")).toBe(
      "https://example.com/pricing"
    );
  });

  test("keeps a URL that has no query string byte-for-byte", () => {
    expect(redactUrlQueryParams("https://example.com/pricing")).toBe("https://example.com/pricing");
  });

  test("keeps the port and a non-default scheme, which are part of the origin", () => {
    expect(redactUrlQueryParams("http://localhost:3000/s/abc?x=1")).toBe("http://localhost:3000/s/abc");
  });

  // Pinned deliberately: the fragment is dropped as well. The OAuth implicit flow puts `access_token`
  // in the fragment, so keeping it under "Anonymize responses" would be the exact leak the toggle is
  // for. Changing this to preserve `#…` is a product decision, not a refactor.
  test("drops the fragment as well as the query", () => {
    expect(redactUrlQueryParams("https://example.com/app#access_token=secret")).toBe(
      "https://example.com/app"
    );
    expect(redactUrlQueryParams("https://example.com/app?a=1#/route")).toBe("https://example.com/app");
  });

  test("returns a malformed URL rather than throwing, and still cuts its query", () => {
    expect(() => redactUrlQueryParams("not a url at all")).not.toThrow();
    expect(redactUrlQueryParams("not a url at all")).toBe("not a url at all");
    // A relative path never parses as an absolute URL, but must not smuggle a token through.
    expect(redactUrlQueryParams("/checkout?session=secret")).toBe("/checkout");
  });

  test("does not concatenate the literal 'null' origin of a schemeless-host URL", () => {
    expect(redactUrlQueryParams("mailto:someone@example.com?subject=hi")).toBe("mailto:someone@example.com");
  });

  test("leaves an empty string alone", () => {
    expect(redactUrlQueryParams("")).toBe("");
  });
});

/** The meta the ingest routes build today, with every reserved key populated. */
const buildFullMeta = (): TResponseMeta => ({
  source: "link",
  url: "https://example.com/survey?token=secret&utm_source=newsletter",
  userAgent: { browser: "Chrome", os: "macOS", device: "desktop" },
  country: "DE",
  action: "clicked-cta",
  ipAddress: "203.0.113.7",
});

describe("applyAnonymizePolicy", () => {
  test("returns the very same object when the toggle is off", () => {
    const meta = buildFullMeta();
    expect(applyAnonymizePolicy(meta, false)).toBe(meta);
  });

  test("does not mutate its argument when the toggle is on", () => {
    const meta = buildFullMeta();
    const before = structuredClone(meta);

    applyAnonymizePolicy(meta, true);

    expect(meta).toEqual(before);
  });

  test("drops every `drop` field and redacts every `redactQuery` field", () => {
    const anonymized = applyAnonymizePolicy(buildFullMeta(), true);

    // `drop`: the key is absent, not blank — that is what makes the field resolve as unset.
    expect(anonymized).not.toHaveProperty("country");
    expect(anonymized).not.toHaveProperty("ipAddress");
    // The whole userAgent object goes, because browser/os/deviceType are all `drop`.
    expect(anonymized).not.toHaveProperty("userAgent");

    // `redactQuery`
    expect(anonymized.url).toBe("https://example.com/survey");

    // `keep`
    expect(anonymized.source).toBe("link");
    expect(anonymized.action).toBe("clicked-cta");
  });

  test("keeps `utm*` campaign attribution, which rides as its own meta key", () => {
    // utm parameters are campaign attribution, not respondent identity, and they are the reason those
    // fields exist. They are kept under Anonymize on purpose. (On this branch they are not yet part of
    // ZResponseMeta — ENG-1841 adds them — so this pins the behaviour of an unclassified key too.)
    const anonymized = applyAnonymizePolicy(
      { ...buildFullMeta(), utm_source: "newsletter", utm_campaign: "spring" } as TResponseMeta,
      true
    );

    expect(anonymized).toMatchObject({ utm_source: "newsletter", utm_campaign: "spring" });
  });

  test("handles a meta that has none of the sensitive keys", () => {
    expect(applyAnonymizePolicy({ source: "link" }, true)).toEqual({ source: "link" });
  });

  test("passes an undefined meta through untouched", () => {
    expect(applyAnonymizePolicy(undefined, true)).toBeUndefined();
  });

  /**
   * The property the whole design rests on: the policy reads `privacy` off the catalog, so a field
   * added to the catalog as `drop` is suppressed here with **no change to anonymize.ts**. Asserted by
   * adding an entry to the real catalog rather than by re-listing today's field names, because a test
   * that hardcoded the names would pass just as happily against a hardcoded implementation.
   */
  test("suppresses a newly added `drop` catalog entry with no code change", async () => {
    // Both names are deliberately hypothetical - they are not in the real catalog. The point is
    // that the policy is driven by the catalog's `privacy` field, so a future entry is covered
    // without touching anonymize.ts.
    const newlyAddedEntry: TReservedFieldCatalogEntry = {
      name: "respondentEmail",
      dataType: "string",
      availability: "server",
      privacy: "drop",
      read: (response) => response.meta.source,
    };
    const newlyAddedRedactedEntry: TReservedFieldCatalogEntry = {
      name: "landingUrl",
      dataType: "string",
      availability: "client",
      privacy: "redactQuery",
      read: (response) => response.meta.url,
    };

    vi.resetModules();
    vi.doMock("@formbricks/types/embedded-data-resolver", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@formbricks/types/embedded-data-resolver")>();
      return {
        ...actual,
        RESERVED_FIELD_CATALOG: [...actual.RESERVED_FIELD_CATALOG, newlyAddedEntry, newlyAddedRedactedEntry],
      };
    });

    try {
      // Re-imported so its lookup table is rebuilt from the extended catalog. anonymize.ts is
      // unchanged — that is the point of the test.
      const { applyAnonymizePolicy: applyWithExtendedCatalog } = await import("./anonymize");

      const anonymized = applyWithExtendedCatalog(
        {
          source: "link",
          respondentEmail: "a@b.c",
          landingUrl: "https://example.com/checkout?session=secret",
        } as TResponseMeta,
        true
      );

      expect(anonymized).not.toHaveProperty("respondentEmail");
      expect(anonymized).toHaveProperty("landingUrl", "https://example.com/checkout");
      expect(anonymized.source).toBe("link");
    } finally {
      vi.doUnmock("@formbricks/types/embedded-data-resolver");
      vi.resetModules();
    }
  });
});

/**
 * AC: a suppressed reserved field must resolve as **unset** — never an empty string and never a stale
 * value — so a recall token falls through to its `fallback:` text.
 */
describe("a suppressed reserved field resolves as unset", () => {
  const buildResponse = (meta: TResponseMeta) => ({
    id: "response-id",
    surveyId: "survey-id",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:01:00.000Z"),
    finished: true,
    language: "en",
    ttc: { _total: 60_000 },
    meta,
  });

  test("projectReservedValues omits the key rather than projecting an empty string", () => {
    const anonymizedMeta = applyAnonymizePolicy(buildFullMeta(), true);
    const projected = projectReservedValues(RESERVED_FIELD_CATALOG, buildResponse(anonymizedMeta));

    expect(projected).not.toHaveProperty("country");
    expect(projected).not.toHaveProperty("browser");
    expect(projected).not.toHaveProperty("os");
    expect(projected).not.toHaveProperty("deviceType");
    expect(projected).not.toHaveProperty("ipAddress");
    // Not suppressed, so still projected — proving the omissions above are the policy, not a broken read.
    expect(projected.source).toBe("link");
    expect(projected.url).toBe("https://example.com/survey");
  });

  test("the recall fallback fires for a suppressed field", () => {
    const anonymizedMeta = applyAnonymizePolicy(buildFullMeta(), true);
    const projected = projectReservedValues(RESERVED_FIELD_CATALOG, buildResponse(anonymizedMeta));

    expect(parseRecallInfo("You are in #recall:country/fallback:unknown#", projected)).toBe(
      "You are in unknown"
    );
  });

  test("the same token renders the real value when the survey is not anonymized", () => {
    const projected = projectReservedValues(RESERVED_FIELD_CATALOG, buildResponse(buildFullMeta()));

    expect(parseRecallInfo("You are in #recall:country/fallback:unknown#", projected)).toBe("You are in DE");
  });
});
