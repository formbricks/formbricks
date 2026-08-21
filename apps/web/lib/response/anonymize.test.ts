import { describe, expect, test, vi } from "vitest";
import {
  RESERVED_FIELD_CATALOG,
  type TReservedFieldCatalogEntry,
  projectReservedValues,
} from "@formbricks/types/embedded-data-resolver";
import { type TResponseMeta } from "@formbricks/types/responses";
import { parseRecallInfo } from "@/lib/utils/recall";
import { applyAnonymizePolicy } from "./anonymize";

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
      display: "none",
      read: (response) => response.meta.source,
    };
    const newlyAddedRedactedEntry: TReservedFieldCatalogEntry = {
      name: "landingUrl",
      dataType: "string",
      availability: "client",
      privacy: "redactQuery",
      display: "none",
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
 * The drift guard for `COMPOSITE_META_KEYS`, which names the `meta.userAgent` sub-keys by hand because
 * `device` (the sub-key) and `deviceType` (the field) genuinely differ in spelling. A catalog entry
 * added later that also reads `meta.userAgent` would not be listed there, and would then survive
 * anonymization silently — the one failure mode this file cannot detect by reading itself.
 *
 * The userAgent-backed entries are therefore DISCOVERED rather than restated: restating the list here
 * would drift in exactly the same way it drifts over there.
 */
describe("every userAgent-backed drop field is actually dropped", () => {
  const buildProbeResponse = (meta: TResponseMeta) => ({
    id: "response-id",
    surveyId: "survey-id",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:01:00.000Z"),
    finished: true,
    language: "en",
    data: {},
    variables: {},
    ttc: { _total: 60_000 },
    meta,
  });

  /** An entry is userAgent-backed if it resolves with `meta.userAgent` present and not without it. */
  const userAgentBackedNames = (() => {
    const { userAgent: _dropped, ...metaWithoutUserAgent } = buildFullMeta();
    const withUserAgent = projectReservedValues(RESERVED_FIELD_CATALOG, buildProbeResponse(buildFullMeta()));
    const withoutUserAgent = projectReservedValues(
      RESERVED_FIELD_CATALOG,
      buildProbeResponse(metaWithoutUserAgent)
    );

    return RESERVED_FIELD_CATALOG.filter(
      (entry) => entry.name in withUserAgent && !(entry.name in withoutUserAgent)
    ).map((entry) => entry.name);
  })();

  test("the probe finds the entries the fixture's userAgent actually backs", () => {
    // Guards the guard: if the probe silently found nothing, every assertion below would pass vacuously.
    expect(userAgentBackedNames).toEqual(["browser", "os", "deviceType"]);
  });

  test("anonymizing suppresses each of them", () => {
    const anonymized = applyAnonymizePolicy(buildFullMeta(), true);
    const projected = projectReservedValues(RESERVED_FIELD_CATALOG, buildProbeResponse(anonymized));

    const droppable = RESERVED_FIELD_CATALOG.filter(
      (entry) => userAgentBackedNames.includes(entry.name) && entry.privacy === "drop"
    ).map((entry) => entry.name);

    // Filtered to `drop` on purpose: a userAgent-backed entry classified `keep` SHOULD survive, and
    // this must not turn into a rule that every device field is private.
    expect(droppable.length).toBeGreaterThan(0);
    for (const name of droppable) {
      expect(projected).not.toHaveProperty(name);
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
