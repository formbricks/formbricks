import { describe, expect, test } from "vitest";
import {
  collectDeclaredFieldNames,
  describeDeclaredFieldNameError,
  describeDeclaredFieldNameErrors,
  validateNewDeclaredFieldNames,
} from "./declared-field-guard";
import { TValidateIdErrorCode } from "./validation";

const refusedNames = (params: { existing: string[]; incoming: string[] }): string[] =>
  validateNewDeclaredFieldNames(params).map((error) => error.field);

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
      expect(refusedNames({ existing: [], incoming: ["country"] })).toEqual(["country"]);
      expect(refusedNames({ existing: ["other_field"], incoming: ["country"] })).toEqual(["country"]);
    });

    test("a grandfathered survey may still not add a *different* reserved name", () => {
      expect(refusedNames({ existing: ["country"], incoming: ["country", "browser"] })).toEqual(["browser"]);
    });

    test("grandfathering is per name, not a blanket exemption for the payload", () => {
      expect(refusedNames({ existing: ["country"], incoming: ["country", "team_size", "url"] })).toEqual([
        "url",
      ]);
    });

    test("the reprieve is spent by deleting the field: re-adding it afterwards is refused", () => {
      // `existing` is the survey's CURRENT names, so grandfathering lasts as long as the field does.
      // Pinned because it is a decision, not an accident: remembering every name a survey ever had
      // would need storage this layer has no access to, and a survey that gives up its declared
      // `country` gains the auto-captured one in exchange.
      const survey = { existing: ["country", "team_size"] };

      // Still there, still fine — the save that keeps it, and the save that drops it, both pass.
      expect(refusedNames({ ...survey, incoming: ["country", "team_size"] })).toEqual([]);
      expect(refusedNames({ ...survey, incoming: ["team_size"] })).toEqual([]);

      // After that save the survey no longer declares it, so the name is new again.
      expect(refusedNames({ existing: ["team_size"], incoming: ["team_size", "country"] })).toEqual([
        "country",
      ]);
    });
  });

  describe("case-insensitivity", () => {
    test("a reserved name is refused under any casing", () => {
      expect(refusedNames({ existing: [], incoming: ["Country"] })).toEqual(["Country"]);
      expect(refusedNames({ existing: [], incoming: ["COUNTRY"] })).toEqual(["COUNTRY"]);
      // camelCase catalog entries are stored lowercased in the reserved set.
      expect(refusedNames({ existing: [], incoming: ["deviceType"] })).toEqual(["deviceType"]);
    });

    test("`existing` grandfathers across casing too", () => {
      expect(refusedNames({ existing: ["Country"], incoming: ["country"] })).toEqual([]);
      expect(refusedNames({ existing: ["country"], incoming: ["Country"] })).toEqual([]);
    });

    test("a duplicated incoming name yields at most one error", () => {
      expect(refusedNames({ existing: [], incoming: ["country", "Country"] })).toEqual(["country"]);
    });
  });

  describe("which names are refused", () => {
    test("refuses Tier-1 reserved field names (RESERVED_FIELD_NAMES)", () => {
      for (const name of ["source", "url", "country", "browser", "os", "finished", "language"]) {
        expect(refusedNames({ existing: [], incoming: [name] })).toEqual([name]);
      }
    });

    test("refuses link-survey system params and forbidden ids (RESERVED_DECLARED_FIELD_NAMES)", () => {
      for (const name of ["userid", "lang", "suid"]) {
        expect(refusedNames({ existing: [], incoming: [name] })).toEqual([name]);
      }
    });

    test("refuses names that are not safe identifiers", () => {
      const errors = validateNewDeclaredFieldNames({ existing: [], incoming: ["Team Size"] });
      expect(errors).toHaveLength(1);
      expect(errors[0].code).not.toBe(TValidateIdErrorCode.Reserved);
    });

    test("allows an ordinary new name", () => {
      expect(refusedNames({ existing: [], incoming: ["team_size", "plan", "signup_source"] })).toEqual([]);
    });

    test("reports a reserved name with the Reserved code", () => {
      const errors = validateNewDeclaredFieldNames({ existing: [], incoming: ["country"] });
      expect(errors).toEqual([{ code: TValidateIdErrorCode.Reserved, field: "country" }]);
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
      })
    ).toEqual([]);
  });
});

describe("describeDeclaredFieldNameError", () => {
  const reasonFor = (name: string): string =>
    describeDeclaredFieldNameError(validateNewDeclaredFieldNames({ existing: [], incoming: [name] })[0]);

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
    // `UserRegion`, not `Team Size`: a space is refused by the shared `HasSpaces` check BEFORE
    // `isSafeIdentifier` is consulted, so the old spelling never exercised this reason — it passed
    // only while every non-reserved code returned the same sentence (the drift ENG-2539's review
    // caught). `UserRegion` genuinely produces `NotSafeIdentifier`.
    const reason = reasonFor("UserRegion");

    expect(reason).toContain("lowercase letter");
    expect(reason).not.toContain("reserved");
  });

  // ENG-2539: the reason follows the check that fired. One sentence for everything non-reserved sent
  // a caller in circles — told about lowercase letters when the space was the whole problem, and ""
  // read identically to a charset violation.
  describe("the reason names the check that actually fired", () => {
    test("a space names the space, not the charset", () => {
      const reason = reasonFor("team size");

      expect(reason).toContain("spaces");
      expect(reason).not.toContain("lowercase letter");
    });

    test("an illegal character names the legacy charset, not the strict one", () => {
      const reason = reasonFor("user:name");

      expect(reason).toContain("letters, numbers, underscores and hyphens");
      expect(reason).not.toContain("lowercase letter");
    });

    test("an empty name says so", () => {
      const reason = reasonFor("");

      expect(reason).toContain("must not be empty");
      expect(reason).not.toContain("lowercase letter");
    });
  });
});

describe("describeDeclaredFieldNameErrors", () => {
  test("names every refused field and says existing fields keep working", () => {
    const message = describeDeclaredFieldNameErrors(
      validateNewDeclaredFieldNames({ existing: [], incoming: ["country", "url"] })
    );

    expect(message).toContain('"country"');
    expect(message).toContain('"url"');
    expect(message).toContain("newly added names only");
  });
});
