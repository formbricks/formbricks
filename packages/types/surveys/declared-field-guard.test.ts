import { describe, expect, test } from "vitest";
import {
  collectDeclaredFieldNames,
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
