import { describe, expect, test } from "vitest";
import { RESERVED_FIELD_CATALOG, dropShadowedReservedEntries } from "../embedded-data-resolver";
import { RESERVED_FIELD_NAMES } from "../reserved-field-names";
import {
  LINK_SURVEY_SYSTEM_PARAMS,
  RESERVED_DECLARED_FIELD_NAMES,
  TValidateIdErrorCode,
  validateId,
} from "./validation";

describe("validateId", () => {
  const noExistingIds: [string[], string[], string[], string[]] = [[], [], [], []];

  describe("lenient mode (element and question ids)", () => {
    test("accepts legacy caps and hyphen names", () => {
      expect(validateId("Legacy-Field", ...noExistingIds)).toBeNull();
      expect(validateId("Q1", ...noExistingIds)).toBeNull();
      expect(validateId("UserID", ...noExistingIds)).toBeNull();
      expect(validateId("_legacy", ...noExistingIds)).toBeNull();
      expect(validateId("1foo", ...noExistingIds)).toBeNull();
    });

    test("accepts safe identifiers too", () => {
      expect(validateId("user_name", ...noExistingIds)).toBeNull();
    });
  });

  describe("strict mode (new declared field names)", () => {
    const strict = { rule: "declaredFieldStrict" } as const;

    test("rejects legacy caps and hyphen names", () => {
      expect(validateId("Legacy-Field", ...noExistingIds, strict)).toEqual({
        code: TValidateIdErrorCode.NotSafeIdentifier,
        field: "Legacy-Field",
      });
      expect(validateId("Q1", ...noExistingIds, strict)?.code).toBe(TValidateIdErrorCode.NotSafeIdentifier);
      // Deliberately not `UserID`: that lowercases onto a reserved name, so it is reported as
      // Reserved instead. See the reserved-name block below.
      expect(validateId("CustomerRef", ...noExistingIds, strict)?.code).toBe(
        TValidateIdErrorCode.NotSafeIdentifier
      );
    });

    test("rejects names that do not start with a lowercase letter", () => {
      expect(validateId("_legacy", ...noExistingIds, strict)?.code).toBe(
        TValidateIdErrorCode.NotSafeIdentifier
      );
      expect(validateId("1foo", ...noExistingIds, strict)?.code).toBe(TValidateIdErrorCode.NotSafeIdentifier);
    });

    test("accepts safe identifiers", () => {
      expect(validateId("user_name", ...noExistingIds, strict)).toBeNull();
      expect(validateId("attr123", ...noExistingIds, strict)).toBeNull();
    });

    test("reports the more specific error first for characters the lenient rule also rejects", () => {
      expect(validateId("user:name", ...noExistingIds, strict)?.code).toBe(TValidateIdErrorCode.InvalidChars);
    });
  });

  /**
   * A new declared field name must be refused whenever `getHiddenFieldsFromSearchParams` would refuse
   * to capture it, otherwise the editor accepts a field that can never receive a value. Both ends read
   * `RESERVED_DECLARED_FIELD_NAMES`, so these cases pin the two together.
   */
  describe("reserved names under declaredFieldStrict", () => {
    const strict = { rule: "declaredFieldStrict" } as const;

    test("rejects every reserved name in any casing", () => {
      for (const reserved of RESERVED_DECLARED_FIELD_NAMES) {
        for (const candidate of [reserved, reserved.toUpperCase()]) {
          expect(validateId(candidate, ...noExistingIds, strict)).toEqual({
            code: TValidateIdErrorCode.Reserved,
            field: candidate,
          });
        }
      }
    });

    test("rejects the link-survey system params the old rule let through", () => {
      for (const systemParam of LINK_SURVEY_SYSTEM_PARAMS) {
        expect(validateId(systemParam, ...noExistingIds, strict)?.code).toBe(TValidateIdErrorCode.Reserved);
      }
    });

    test("rejects the FORBIDDEN_IDS casings the old rule let through", () => {
      // Each of these passed `isSafeIdentifier` and missed the case-sensitive `FORBIDDEN_IDS` check,
      // so the editor used to accept them.
      for (const name of ["userid", "verifiedemail", "multilanguage", "welcomecard"]) {
        expect(validateId(name, ...noExistingIds, strict)?.code).toBe(TValidateIdErrorCode.Reserved);
      }
    });

    test("still accepts names that merely contain a reserved word", () => {
      expect(validateId("user_id_ref", ...noExistingIds, strict)).toBeNull();
      expect(validateId("verified", ...noExistingIds, strict)).toBeNull();
      expect(validateId("started_at", ...noExistingIds, strict)).toBeNull();
      expect(validateId("country_code", ...noExistingIds, strict)).toBeNull();
    });

    /**
     * ENG-1839. The Tier-1 Embedded Data catalog is a second blocklist on the strict path only:
     * a field named `country` would be permanently shadowed by the reserved read of the same name.
     * `language` moved from the accepted list above to here for exactly that reason.
     */
    test("rejects the Tier-1 reserved field names in any casing", () => {
      for (const reserved of RESERVED_FIELD_NAMES) {
        for (const candidate of [reserved, reserved.toUpperCase()]) {
          expect(validateId(candidate, ...noExistingIds, strict)).toEqual({
            code: TValidateIdErrorCode.Reserved,
            field: candidate,
          });
        }
      }
      // The camelCase spelling of a catalog entry is refused too — the set stores them lowercased.
      expect(validateId("deviceType", ...noExistingIds, strict)?.code).toBe(TValidateIdErrorCode.Reserved);
    });

    test("leaves the lenient path alone so element and question ids keep parsing", () => {
      // ENG-1839: the Tier-1 catalog must NOT reach the lenient path. `ZSurveyHiddenFields` parses
      // surveys loaded from the database through it, so a survey that already declares `country`
      // has to keep loading.
      expect(validateId("country", ...noExistingIds)).toBeNull();
      expect(validateId("browser", ...noExistingIds)).toBeNull();
      expect(validateId("language", ...noExistingIds)).toBeNull();

      // Element/question id renames must not start failing: only the exact-case FORBIDDEN_IDS entry
      // is reserved there, exactly as before this change.
      expect(validateId("userid", ...noExistingIds)).toBeNull();
      expect(validateId("lang", ...noExistingIds)).toBeNull();
      expect(validateId("startat", ...noExistingIds)).toBeNull();
      expect(validateId("WelcomeCard", ...noExistingIds)).toBeNull();
      expect(validateId("userId", ...noExistingIds)?.code).toBe(TValidateIdErrorCode.Reserved);
    });
  });

  describe("shared checks are unchanged by the mode", () => {
    for (const [label, options] of [
      ["lenient", undefined],
      ["strict", { rule: "declaredFieldStrict" } as const],
    ] as const) {
      test(`empty input is rejected (${label})`, () => {
        expect(validateId("", ...noExistingIds, options)).toEqual({
          code: TValidateIdErrorCode.Empty,
          field: "",
        });
        expect(validateId("   ", ...noExistingIds, options)?.code).toBe(TValidateIdErrorCode.Empty);
      });

      test(`duplicates across elements, hidden fields, endings and variables are rejected (${label})`, () => {
        expect(validateId("field", ["field"], [], [], [], options)?.code).toBe(
          TValidateIdErrorCode.Duplicate
        );
        expect(validateId("field", [], ["field"], [], [], options)?.code).toBe(
          TValidateIdErrorCode.Duplicate
        );
        expect(validateId("field", [], [], ["field"], [], options)?.code).toBe(
          TValidateIdErrorCode.Duplicate
        );
        expect(validateId("field", [], [], [], ["field"], options)?.code).toBe(
          TValidateIdErrorCode.Duplicate
        );
      });

      test(`duplicate detection stays case-insensitive (${label})`, () => {
        expect(validateId("field", [], [], ["FIELD"], [], options)?.code).toBe(
          TValidateIdErrorCode.Duplicate
        );
      });

      test(`reserved keywords are rejected (${label})`, () => {
        expect(validateId("userId", ...noExistingIds, options)).toEqual({
          code: TValidateIdErrorCode.Reserved,
          field: "userId",
        });
        expect(validateId("verifiedEmail", ...noExistingIds, options)?.code).toBe(
          TValidateIdErrorCode.Reserved
        );
      });

      test(`spaces are rejected before the character rule (${label})`, () => {
        expect(validateId("my field", ...noExistingIds, options)).toEqual({
          code: TValidateIdErrorCode.HasSpaces,
          field: "my field",
        });
      });

      test(`disallowed characters are rejected (${label})`, () => {
        expect(validateId("field!", ...noExistingIds, options)?.code).toBe(TValidateIdErrorCode.InvalidChars);
        expect(validateId("email@domain", ...noExistingIds, options)?.code).toBe(
          TValidateIdErrorCode.InvalidChars
        );
      });
    }
  });
  /**
   * **ENG-2539: the editor and the management API disagree on purpose.** This block is the pin the
   * ticket asks for, so the next person does not "tidy" three rules back into one.
   *
   * `declaredFieldPortable` refuses exactly one thing — a name
   * `getHiddenFieldsFromSearchParams` could never fill. `declaredFieldStrict` refuses that plus the
   * Tier-1 catalog plus `isSafeIdentifier`. If a change makes the two agree, this goes red.
   */
  describe("declaredFieldPortable vs declaredFieldStrict (the API/editor asymmetry)", () => {
    const portable = { rule: "declaredFieldPortable" } as const;
    const strict = { rule: "declaredFieldStrict" } as const;

    /** Ordinary names the bundled charset rule refused as collateral. `UserRegion` is the worst of it. */
    const charsetCasualties = ["UserRegion", "user-region", "_internal", "1st_visit"];

    /** Tier-1 catalog names. The field works and is grandfathered; refusing is hygiene, not correctness. */
    const catalogNames = ["url", "country", "language", "timezone"];

    /** Names no survey could ever fill from a URL param, under any casing. */
    const unfillableNames = ["lang", "verify", "startat", "userId", "suToken", "VERIFIEDEMAIL"];

    test("the API accepts what only the charset rule refused", () => {
      for (const name of charsetCasualties) {
        expect(validateId(name, ...noExistingIds, portable), name).toBeNull();
        expect(validateId(name, ...noExistingIds, strict)?.code, name).toBe(
          TValidateIdErrorCode.NotSafeIdentifier
        );
      }
    });

    test("the API accepts Tier-1 catalog names; the editor refuses them", () => {
      for (const name of catalogNames) {
        expect(validateId(name, ...noExistingIds, portable), name).toBeNull();
        expect(validateId(name, ...noExistingIds, strict)?.code, name).toBe(TValidateIdErrorCode.Reserved);
      }
    });

    test("BOTH refuse a name that could never receive a value", () => {
      // The half that must never be relaxed: `getHiddenFieldsFromSearchParams` drops these params, so
      // a field declared under one stays empty forever. `suToken` is a credential.
      for (const name of unfillableNames) {
        expect(validateId(name, ...noExistingIds, portable)?.code, name).toBe(TValidateIdErrorCode.Reserved);
        expect(validateId(name, ...noExistingIds, strict)?.code, name).toBe(TValidateIdErrorCode.Reserved);
      }
    });

    test("the API still refuses every RESERVED_DECLARED_FIELD_NAMES entry, in any casing", () => {
      // Derived from the set rather than a literal list, so a name added there is covered without
      // touching this test — and cannot be added on the strict path only.
      for (const reserved of RESERVED_DECLARED_FIELD_NAMES) {
        for (const candidate of [reserved, reserved.toUpperCase()]) {
          expect(validateId(candidate, ...noExistingIds, portable)?.code, candidate).toBe(
            TValidateIdErrorCode.Reserved
          );
        }
      }
    });

    test("the API accepts every catalog name that is not also unfillable", () => {
      // `source` is the one Tier-1 entry that is also a link-survey system param, so it stays refused
      // for the stronger reason. Everything else in the catalog is now creatable through the API.
      for (const reserved of RESERVED_FIELD_NAMES) {
        const expected = RESERVED_DECLARED_FIELD_NAMES.has(reserved) ? TValidateIdErrorCode.Reserved : null;
        expect(validateId(reserved, ...noExistingIds, portable)?.code ?? null, reserved).toBe(expected);
      }
    });

    test("the shared checks apply to the API rule too", () => {
      // Relaxing two rules must not relax the rest: a blank name, a duplicate, a space or a character
      // `ZSurveyHiddenFields` itself rejects on the load path would all create a survey that cannot be
      // read back.
      expect(validateId("", ...noExistingIds, portable)?.code).toBe(TValidateIdErrorCode.Empty);
      expect(validateId("Team Size", ...noExistingIds, portable)?.code).toBe(TValidateIdErrorCode.HasSpaces);
      expect(validateId("user:name", ...noExistingIds, portable)?.code).toBe(
        TValidateIdErrorCode.InvalidChars
      );
      expect(validateId("plan", ["plan"], [], [], [], portable)?.code).toBe(TValidateIdErrorCode.Duplicate);
    });

    test("a catalog name is accepted under any casing, and only the exact spelling shadows", () => {
      // The API skips the catalog check entirely, so every casing of a catalog name is creatable.
      // `dropShadowedReservedEntries` matches EXACTLY, so only the catalog's own spelling takes
      // precedence; any other casing is simply a different field and the survey carries both. That
      // pair is the decision, not an oversight (ENG-2539), and the docs state it in those terms - so
      // this asserts both halves together. Deriving the casings from the catalog rather than listing
      // them means an entry added later is covered without touching this test.
      for (const entry of RESERVED_FIELD_CATALOG) {
        // `source` is in both catalogs: unfillable wins, and no casing of it is creatable at all.
        if (RESERVED_DECLARED_FIELD_NAMES.has(entry.name.toLowerCase())) continue;

        const variants = [...new Set([entry.name.toUpperCase(), entry.name.toLowerCase()])].filter(
          (variant) => variant !== entry.name
        );

        // The exact spelling: accepted, and it drops its own catalog entry.
        expect(validateId(entry.name, ...noExistingIds, portable), entry.name).toBeNull();
        expect(
          dropShadowedReservedEntries(RESERVED_FIELD_CATALOG, [entry.name]).map(({ name }) => name),
          entry.name
        ).not.toContain(entry.name);

        for (const variant of variants) {
          // Any other casing: also accepted, but it does NOT drop the entry.
          expect(validateId(variant, ...noExistingIds, portable), variant).toBeNull();
          expect(
            dropShadowedReservedEntries(RESERVED_FIELD_CATALOG, [variant]).map(({ name }) => name),
            variant
          ).toContain(entry.name);
          // ...and the editor refuses it outright, whatever the casing.
          expect(validateId(variant, ...noExistingIds, strict)?.code, variant).toBe(
            TValidateIdErrorCode.Reserved
          );
        }
      }
    });

    test("neither declared-field rule touches the legacy id path", () => {
      // `ZSurveyHiddenFields` parses stored surveys through `legacyId`, so a survey already declaring
      // `country` or `lang` has to keep loading whatever either rule above decides.
      expect(validateId("country", ...noExistingIds)).toBeNull();
      expect(validateId("lang", ...noExistingIds)).toBeNull();
      expect(validateId("UserRegion", ...noExistingIds)).toBeNull();
    });
  });
});
