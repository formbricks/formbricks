import { describe, expect, test } from "vitest";
import {
  collectDeclaredFieldNames,
  describeDeclaredFieldNameError,
  describeDeclaredFieldNameErrors,
  validateNewDeclaredFieldNames,
} from "./declared-field-guard";
import { TValidateIdErrorCode } from "./validation";

/**
 * Refused names under the **API** rule, which is what every server write path passes (ENG-2539). The
 * grandfathering and case-insensitivity blocks below are rule-independent, so they read better
 * against one rule; `describe("which names are refused")` asserts both explicitly.
 */
const refusedNames = (params: { existing: string[]; incoming: string[] }): string[] =>
  validateNewDeclaredFieldNames({ ...params, rule: "declaredFieldPortable" }).map((error) => error.field);

/** Refused names under the **editor** rule — all three blocklists plus `isSafeIdentifier`. */
const refusedNamesStrict = (params: { existing: string[]; incoming: string[] }): string[] =>
  validateNewDeclaredFieldNames({ ...params, rule: "declaredFieldStrict" }).map((error) => error.field);

describe("validateNewDeclaredFieldNames", () => {
  describe("grandfathering", () => {
    test("a reserved name already in `existing` passes", () => {
      // The whole point of the ticket: surveys in production already declare these, their values
      // live at response.data["country"], and nothing may be renamed.
      expect(refusedNames({ existing: ["country"], incoming: ["country"] })).toEqual([]);
      expect(
        refusedNames({
          existing: ["country", "url", "source", "browser"],
          incoming: ["country", "url", "source", "browser"],
        })
      ).toEqual([]);
    });

    test("the same name absent from `existing` is refused", () => {
      // `lang` rather than `country`: both rules refuse a name that can never be filled, whereas the
      // catalog half is the editor's rule only (ENG-2539). Grandfathering itself is rule-independent,
      // so it is asserted on the name both rules agree about.
      expect(refusedNames({ existing: [], incoming: ["lang"] })).toEqual(["lang"]);
      expect(refusedNames({ existing: ["other_field"], incoming: ["lang"] })).toEqual(["lang"]);
      // Same under the editor rule, including the catalog half.
      expect(refusedNamesStrict({ existing: [], incoming: ["country"] })).toEqual(["country"]);
      expect(refusedNamesStrict({ existing: ["other_field"], incoming: ["country"] })).toEqual(["country"]);
    });

    test("a grandfathered survey may still not add a *different* reserved name", () => {
      expect(refusedNames({ existing: ["lang"], incoming: ["lang", "verify"] })).toEqual(["verify"]);
      expect(refusedNamesStrict({ existing: ["country"], incoming: ["country", "browser"] })).toEqual([
        "browser",
      ]);
    });

    test("grandfathering is per name, not a blanket exemption for the payload", () => {
      expect(refusedNames({ existing: ["lang"], incoming: ["lang", "team_size", "verify"] })).toEqual([
        "verify",
      ]);
      expect(
        refusedNamesStrict({ existing: ["country"], incoming: ["country", "team_size", "url"] })
      ).toEqual(["url"]);
    });

    test("the reprieve is spent by deleting the field: re-adding it afterwards is refused", () => {
      // `existing` is the survey's CURRENT names, so grandfathering lasts as long as the field does.
      // Pinned because it is a decision, not an accident: remembering every name a survey ever had
      // would need storage this layer has no access to, and a survey that gives up its declared
      // `country` gains the auto-captured one in exchange.
      const survey = { existing: ["lang", "team_size"] };

      // Still there, still fine — the save that keeps it, and the save that drops it, both pass.
      expect(refusedNames({ ...survey, incoming: ["lang", "team_size"] })).toEqual([]);
      expect(refusedNames({ ...survey, incoming: ["team_size"] })).toEqual([]);

      // After that save the survey no longer declares it, so the name is new again.
      expect(refusedNames({ existing: ["team_size"], incoming: ["team_size", "lang"] })).toEqual(["lang"]);
    });
  });

  describe("case-insensitivity", () => {
    test("a reserved name is refused under any casing", () => {
      expect(refusedNames({ existing: [], incoming: ["Lang"] })).toEqual(["Lang"]);
      expect(refusedNames({ existing: [], incoming: ["LANG"] })).toEqual(["LANG"]);
      expect(refusedNames({ existing: [], incoming: ["userId"] })).toEqual(["userId"]);
      // camelCase catalog entries are stored lowercased in the reserved set — editor rule only.
      expect(refusedNamesStrict({ existing: [], incoming: ["deviceType"] })).toEqual(["deviceType"]);
      expect(refusedNamesStrict({ existing: [], incoming: ["COUNTRY"] })).toEqual(["COUNTRY"]);
    });

    test("`existing` grandfathers across casing too", () => {
      expect(refusedNames({ existing: ["Lang"], incoming: ["lang"] })).toEqual([]);
      expect(refusedNames({ existing: ["lang"], incoming: ["Lang"] })).toEqual([]);
      expect(refusedNamesStrict({ existing: ["Country"], incoming: ["country"] })).toEqual([]);
    });

    test("a duplicated incoming name yields at most one error", () => {
      expect(refusedNames({ existing: [], incoming: ["lang", "Lang"] })).toEqual(["lang"]);
    });
  });

  describe("which names are refused", () => {
    test("BOTH rules refuse link-survey system params and forbidden ids", () => {
      // The half that must never be relaxed: `getHiddenFieldsFromSearchParams` drops these params, so
      // a field declared under one could never receive a value.
      for (const name of ["userid", "lang", "suid", "verify", "startat"]) {
        expect(refusedNames({ existing: [], incoming: [name] }), name).toEqual([name]);
        expect(refusedNamesStrict({ existing: [], incoming: [name] }), name).toEqual([name]);
      }
    });

    test("ENG-2539: the API ACCEPTS Tier-1 catalog names, the editor refuses them", () => {
      // These params *are* captured, so the field works and is grandfathered exactly like the 95
      // production surveys already declaring `url`. Refusing at a documented API boundary broke
      // automation that re-creates surveys from a stored JSON export — it reproduced unprompted while
      // seeding fixtures, with `hiddenFields: ["plan", "language"]` returning 400.
      for (const name of ["url", "country", "language", "timezone", "browser", "os", "finished"]) {
        expect(refusedNames({ existing: [], incoming: [name] }), name).toEqual([]);
        expect(refusedNamesStrict({ existing: [], incoming: [name] }), name).toEqual([name]);
      }
      // `source` is the one catalog entry that is ALSO a link-survey system param, so it stays refused
      // on both — for the stronger reason.
      expect(refusedNames({ existing: [], incoming: ["source"] })).toEqual(["source"]);
    });

    test("ENG-2539: the API ACCEPTS names only the charset rule refused", () => {
      // Collateral from the bundled rule, and nothing to do with Embedded Data. `UserRegion` is the
      // worst of it: an ordinary camelCase name with nothing wrong with it.
      for (const name of ["UserRegion", "user-region", "_internal", "1st_visit"]) {
        expect(refusedNames({ existing: [], incoming: [name] }), name).toEqual([]);
        expect(refusedNamesStrict({ existing: [], incoming: [name] }), name).toEqual([name]);
      }
    });

    test("the editor rule reports a non-safe-identifier without the Reserved code", () => {
      const errors = validateNewDeclaredFieldNames({
        existing: [],
        incoming: ["Team Size"],
        rule: "declaredFieldStrict",
      });
      expect(errors).toHaveLength(1);
      expect(errors[0].code).not.toBe(TValidateIdErrorCode.Reserved);
    });

    test("a name with a space is refused under BOTH rules", () => {
      // Relaxing the charset rule must not relax the shared checks: `ZSurveyHiddenFields` rejects a
      // space on the load path, so such a survey could be created and then fail to read back.
      expect(refusedNames({ existing: [], incoming: ["Team Size"] })).toEqual(["Team Size"]);
      expect(refusedNamesStrict({ existing: [], incoming: ["Team Size"] })).toEqual(["Team Size"]);
    });

    test("allows an ordinary new name", () => {
      expect(refusedNames({ existing: [], incoming: ["team_size", "plan", "signup_source"] })).toEqual([]);
      expect(refusedNamesStrict({ existing: [], incoming: ["team_size", "plan"] })).toEqual([]);
    });

    test("reports a reserved name with the Reserved code", () => {
      const errors = validateNewDeclaredFieldNames({
        existing: [],
        incoming: ["lang"],
        rule: "declaredFieldPortable",
      });
      expect(errors).toEqual([{ code: TValidateIdErrorCode.Reserved, field: "lang" }]);
    });

    test("a name colliding with an existing one is not reported as a duplicate", () => {
      // Duplicate detection belongs to the reconcile and the v3 reference validation; reporting it
      // here would turn every grandfathered name into an error.
      expect(refusedNames({ existing: ["team_size"], incoming: ["team_size"] })).toEqual([]);
    });
  });
});

describe("collectDeclaredFieldNames", () => {
  test("collects variable names and hidden field ids", () => {
    expect(
      collectDeclaredFieldNames({
        variables: [{ id: "v1", name: "score", type: "number", value: 0 }],
        hiddenFields: { fieldIds: ["team_size", "plan"] },
      })
    ).toEqual(["score", "team_size", "plan"]);
  });

  test("a payload omitting `hiddenFields` declares nothing from it", () => {
    // Presence is `!== undefined`, not `in` — mirroring `resolveDesiredEmbeddedFields`. A patch that
    // never mentioned hiddenFields must not read as declaring the empty set, and must not be
    // validated as if it had re-declared the survey's stored fields either.
    expect(collectDeclaredFieldNames({ variables: [], hiddenFields: undefined })).toEqual([]);
    expect(collectDeclaredFieldNames({})).toEqual([]);
  });

  test("an object literal with both keys spelled out but undefined declares nothing", () => {
    // The exact shape every write seam builds.
    const payload = { variables: undefined, hiddenFields: undefined };
    expect("hiddenFields" in payload).toBe(true);
    expect(collectDeclaredFieldNames(payload)).toEqual([]);
  });

  test("a null carrier declares nothing", () => {
    expect(collectDeclaredFieldNames({ variables: null, hiddenFields: null })).toEqual([]);
  });

  test("hiddenFields present with no fieldIds declares nothing", () => {
    expect(collectDeclaredFieldNames({ hiddenFields: {} })).toEqual([]);
  });

  test("a payload that omits hiddenFields validates no hidden field name", () => {
    expect(
      validateNewDeclaredFieldNames({
        existing: [],
        incoming: collectDeclaredFieldNames({ variables: [], hiddenFields: undefined }),
        rule: "declaredFieldPortable",
      })
    ).toEqual([]);
  });
});

describe("describeDeclaredFieldNameError", () => {
  /**
   * Under the **editor** rule, so both halves of `describeReservedReason` are reachable. The write
   * paths all pass the API rule (ENG-2539) and therefore only ever produce the capture-refusal half,
   * but the rule is this function's parameter rather than its constant — a caller passing the editor
   * rule still needs a sentence, and these cases are what keeps it accurate.
   */
  const reasonFor = (name: string): string =>
    describeDeclaredFieldNameError(
      validateNewDeclaredFieldNames({ existing: [], incoming: [name], rule: "declaredFieldStrict" })[0]
    );

  /** The reason a real API refusal produces — the only shape an integrator can actually receive. */
  const apiReasonFor = (name: string): string =>
    describeDeclaredFieldNameError(
      validateNewDeclaredFieldNames({ existing: [], incoming: [name], rule: "declaredFieldPortable" })[0]
    );

  test("an API refusal always explains itself as a name that can never be filled", () => {
    // Every name the API refuses is in `RESERVED_DECLARED_FIELD_NAMES`, so this is the only reason an
    // integrator ever sees — and it is the one the acceptance criterion asks for: "a message that says
    // why in those terms".
    expect(apiReasonFor("lang")).toContain("never filled from the URL");
    expect(apiReasonFor("verify")).toContain("never filled from the URL");
    expect(apiReasonFor("startat")).toContain("never filled from the URL");
    expect(apiReasonFor("userId")).toContain("never filled from the URL");
  });

  test("a Tier-1 catalog name is not described as unfillable", () => {
    // `RESERVED_FIELD_NAMES` is deliberately absent from the capture-refusal list, so `?country=DE`
    // DOES fill a survey's declared `country`. Telling an integrator otherwise could send them off to
    // remove URL params that work.
    const reason = reasonFor("country");

    expect(reason).toContain("auto-captured system field");
    expect(reason).not.toContain("never filled from the URL");
  });

  test("a link-survey system param is described as unfillable, because it is", () => {
    // `getHiddenFieldsFromSearchParams` skips these, so a field declared under one stays empty.
    const reason = reasonFor("lang");

    expect(reason).toContain("never filled from the URL");
  });

  test("a name in both lists takes the capture-refusal reason", () => {
    // `source` is the one Tier-1 field that is also a link-survey system param. Both statements are
    // true of it; the stronger one wins.
    const reason = reasonFor("source");

    expect(reason).toContain("never filled from the URL");
  });

  test("a name that is merely not a safe identifier keeps the naming-rule reason", () => {
    const reason = reasonFor("Team Size");

    expect(reason).toContain("lowercase letter");
    expect(reason).not.toContain("reserved");
  });
});

describe("describeDeclaredFieldNameErrors", () => {
  test("names every refused field and says existing fields keep working", () => {
    const message = describeDeclaredFieldNameErrors(
      validateNewDeclaredFieldNames({
        existing: [],
        incoming: ["country", "url"],
        rule: "declaredFieldStrict",
      })
    );

    expect(message).toContain('"country"');
    expect(message).toContain('"url"');
    expect(message).toContain("newly added names only");
  });
});
