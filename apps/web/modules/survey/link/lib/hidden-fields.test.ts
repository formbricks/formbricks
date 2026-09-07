import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  LINK_SURVEY_SYSTEM_PARAM_KEYS,
  RESERVED_DECLARED_FIELD_NAMES,
} from "@formbricks/types/surveys/validation";
import { getHiddenFieldsFromSearchParams, warnOnMissingIngestRows } from "./hidden-fields";

describe("getHiddenFieldsFromSearchParams", () => {
  test("reads params that match a declared field exactly", () => {
    const params = new URLSearchParams("customerref=abc&other=ignored");

    expect(getHiddenFieldsFromSearchParams(["customerref"], params)).toEqual({ customerref: "abc" });
  });

  test("matches case-insensitively and keys the record by the declared name", () => {
    const params = new URLSearchParams("customerref=abc");

    expect(getHiddenFieldsFromSearchParams(["CustomerRef"], params)).toEqual({ CustomerRef: "abc" });
  });

  test("prefers an exactly matching param over a case-insensitive one regardless of URL order", () => {
    const declaredFieldIds = ["CustomerRef"];

    expect(
      getHiddenFieldsFromSearchParams(
        declaredFieldIds,
        new URLSearchParams("customerref=lower&CustomerRef=exact")
      )
    ).toEqual({ CustomerRef: "exact" });
    expect(
      getHiddenFieldsFromSearchParams(
        declaredFieldIds,
        new URLSearchParams("CustomerRef=exact&customerref=lower")
      )
    ).toEqual({ CustomerRef: "exact" });
  });

  test("ignores params that match no declared field", () => {
    const params = new URLSearchParams("unrelated=value");

    expect(getHiddenFieldsFromSearchParams(["customerref"], params)).toEqual({});
  });

  test("skips empty values, matching the previous truthiness behavior", () => {
    const params = new URLSearchParams("customerref=&email=someone@example.com");

    expect(getHiddenFieldsFromSearchParams(["customerref", "email"], params)).toEqual({
      email: "someone@example.com",
    });
  });

  test("returns an empty record when the survey declares no hidden fields", () => {
    expect(getHiddenFieldsFromSearchParams([], new URLSearchParams("customerref=abc"))).toEqual({});
  });

  test("fills legacy hyphen and caps field names from a lowercased query string", () => {
    const params = new URLSearchParams("legacy-field_1=value");

    expect(getHiddenFieldsFromSearchParams(["Legacy-Field_1"], params)).toEqual({
      "Legacy-Field_1": "value",
    });
  });

  describe("params the link survey reads for itself are never captured", () => {
    // Stubbed for the whole block: the set-wide loops below each hit the refusal branch dozens of
    // times, and the point of those tests is the record, not the console.
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // This suite runs in the node environment (no window); the warns are browser-gated so they
      // stay out of the operator's SSR log, so the browser is simulated here.
      vi.stubGlobal("window", {});
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
      warnSpy.mockRestore();
      vi.unstubAllGlobals();
    });

    /**
     * Case variants of a system param that are not themselves one — `Source` and `UserId` are the
     * grandfathered spellings production surveys declare. `suid` is skipped for `suId` because it IS
     * a key of its own (`FORBIDDEN_IDS`), so the variant set is filtered against the whole set.
     */
    const caseVariantsOf = (systemKey: string): string[] =>
      Array.from(
        new Set([
          systemKey.toLowerCase(),
          systemKey.toUpperCase(),
          systemKey.charAt(0).toUpperCase() + systemKey.slice(1),
        ])
      ).filter((variant) => !LINK_SURVEY_SYSTEM_PARAM_KEYS.has(variant));

    const paramsOf = (key: string, value: string): URLSearchParams => {
      const params = new URLSearchParams();
      params.set(key, value);
      return params;
    };

    test("stays quiet during SSR — the refusal must not land in the operator's server log", () => {
      vi.unstubAllGlobals();

      const record = getHiddenFieldsFromSearchParams(
        ["Lang", "customerref"],
        new URLSearchParams("lang=de&customerref=abc")
      );

      // Capture behavior is identical on the server pass; only the console line is gated.
      expect(record).toEqual({ customerref: "abc" });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    test("explains a case-insensitive refusal: the spelling that arrived, the field, and the spelling that fills it", () => {
      // The two spellings differ on purpose: a survey declaring `Lang` is matched by `?lang=`, and an
      // author grepping their own survey for the name needs to see the one they typed — and the one
      // to put in the link instead.
      const params = new URLSearchParams("lang=de");

      expect(getHiddenFieldsFromSearchParams(["Lang"], params)).toEqual({});
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('"?lang="');
      expect(warnSpy.mock.calls[0][0]).toContain('"Lang"');
      expect(warnSpy.mock.calls[0][0]).toContain('"?Lang="');
    });

    test("explains that a field named exactly like a system param can never be filled, whatever the URL casing", () => {
      expect(getHiddenFieldsFromSearchParams(["lang"], new URLSearchParams("lang=de"))).toEqual({});
      expect(getHiddenFieldsFromSearchParams(["lang"], new URLSearchParams("LANG=de"))).toEqual({});

      expect(warnSpy).toHaveBeenCalledTimes(2);
      for (const call of warnSpy.mock.calls) {
        expect(call[0]).toContain('"lang"');
        expect(call[0]).toContain("Rename the field");
      }
    });

    test("stays quiet when the reserved param is absent, so an unused declaration is not nagged about", () => {
      expect(getHiddenFieldsFromSearchParams(["lang"], new URLSearchParams("customerref=abc"))).toEqual({});
      expect(warnSpy).not.toHaveBeenCalled();
    });

    test("stays quiet for a field it fills normally", () => {
      expect(
        getHiddenFieldsFromSearchParams(["customerref"], new URLSearchParams("customerref=abc"))
      ).toEqual({ customerref: "abc" });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    // The grandfather rule (ENG-2892). Production surveys declare hidden fields that differ from a
    // reserved name only by case (`Source`, `UserId`, …), and every one of them was filled by the
    // exact-case param before Embedded Data. The link survey reads `source` and `userId`, not these
    // spellings, so capturing them hands over nothing the URL contract owns.
    test("fills a grandfathered case-variant field from its exact spelling", () => {
      expect(getHiddenFieldsFromSearchParams(["Source"], new URLSearchParams("Source=newsletter"))).toEqual({
        Source: "newsletter",
      });
      expect(getHiddenFieldsFromSearchParams(["UserId"], new URLSearchParams("UserId=user-123"))).toEqual({
        UserId: "user-123",
      });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    test("the exact spelling wins over a reserved case variant in the same URL, whatever the order", () => {
      expect(
        getHiddenFieldsFromSearchParams(["Source"], new URLSearchParams("source=link&Source=newsletter"))
      ).toEqual({ Source: "newsletter" });
      expect(
        getHiddenFieldsFromSearchParams(["Source"], new URLSearchParams("Source=newsletter&source=link"))
      ).toEqual({ Source: "newsletter" });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    // `ZSurveyHiddenFields` rejects reserved names case-sensitively, so `Verify` and `UserId` are
    // names an already-stored survey can hold (the editor now refuses to create them).
    // Case-insensitive matching must not let them harvest the real reserved params - `?verify=<jwt>`
    // is the email-verification credential.
    test("does not capture the email-verification token via a case-variant field name", () => {
      const params = new URLSearchParams("verify=eyJhbGciOiJIUzI1NiJ9.token");

      expect(getHiddenFieldsFromSearchParams(["Verify"], params)).toEqual({});
    });

    test("does not capture userId via a case-variant field name", () => {
      for (const params of [new URLSearchParams("userId=user-123"), new URLSearchParams("userid=user-123")]) {
        expect(getHiddenFieldsFromSearchParams(["UserId"], params)).toEqual({});
        expect(getHiddenFieldsFromSearchParams(["USERID"], params)).toEqual({});
        expect(getHiddenFieldsFromSearchParams(["UserID"], params)).toEqual({});
      }
    });

    test("never fills a field declared under a system param's own spelling, whatever casing the URL uses", () => {
      for (const systemKey of LINK_SURVEY_SYSTEM_PARAM_KEYS) {
        for (const paramKey of [systemKey, systemKey.toLowerCase(), systemKey.toUpperCase()]) {
          expect(getHiddenFieldsFromSearchParams([systemKey], paramsOf(paramKey, "leaked"))).toEqual({});
        }
      }
    });

    test("every case variant of a system param is filled by its own exact spelling, and never by the system spelling", () => {
      // `?Verify=` is among these on purpose: it is not the credential — `verify-email-gate.ts` reads
      // `verify` exactly — and a URL carrying it was written for the field.
      for (const systemKey of LINK_SURVEY_SYSTEM_PARAM_KEYS) {
        for (const variant of caseVariantsOf(systemKey)) {
          expect(getHiddenFieldsFromSearchParams([variant], paramsOf(variant, "ok"))).toEqual({
            [variant]: "ok",
          });
          expect(getHiddenFieldsFromSearchParams([variant], paramsOf(systemKey, "leaked"))).toEqual({});
        }
      }
    });

    // The guard and `validateId` read the same lowercased set, so iterating it here means a name added
    // to one end can never be silently capturable at the other.
    test("a reserved spelling never fills a differently-cased field, in either direction", () => {
      for (const reserved of RESERVED_DECLARED_FIELD_NAMES) {
        const uppercased = reserved.toUpperCase();

        expect(getHiddenFieldsFromSearchParams([uppercased], paramsOf(reserved, "leaked"))).toEqual({});
        expect(getHiddenFieldsFromSearchParams([reserved], paramsOf(uppercased, "leaked"))).toEqual({});
      }
    });

    test("still fills non-reserved fields present in the same URL", () => {
      const params = new URLSearchParams("verify=token&customerref=abc");

      expect(getHiddenFieldsFromSearchParams(["Verify", "CustomerRef"], params)).toEqual({
        CustomerRef: "abc",
      });
    });
  });
});

describe("warnOnMissingIngestRows", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubGlobal("window", {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  test("stays quiet during SSR", () => {
    vi.unstubAllGlobals();

    warnOnMissingIngestRows([], ["plan"]);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("warns when the legacy column declares fields but no ingested rows exist — the dropped-join canary", () => {
    warnOnMissingIngestRows([], ["plan", "language"]);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("no ingested Embedded Data rows");
  });

  test("stays quiet on a healthy survey (rows present)", () => {
    warnOnMissingIngestRows(["plan"], ["plan"]);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("stays quiet on a survey that declares nothing at all", () => {
    warnOnMissingIngestRows([], []);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
