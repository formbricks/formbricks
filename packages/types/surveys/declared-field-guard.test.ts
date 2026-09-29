import { describe, expect, test } from "vitest";
import {
  type TDeclaredFieldSource,
  collectDeclaredFieldNames,
  describeDeclaredFieldNameError,
  describeDeclaredFieldNameErrors,
  validateNewDeclaredFieldClashes,
  validateNewDeclaredFieldNames,
  validateNewDeclaredFields,
} from "./declared-field-guard";
import { TValidateIdErrorCode } from "./validation";

const refusedNames = (params: { existing: string[]; incoming: string[] }): string[] =>
  validateNewDeclaredFieldNames(params).map((error) => error.field);

/** A survey's declared fields, spelled the way `TSurvey` carries them. */
const declared = (fields: { variables?: string[]; hiddenFields?: string[] }): TDeclaredFieldSource => ({
  variables: fields.variables?.map((name) => ({ id: `var_${name}`, name, type: "text", value: "" })),
  hiddenFields: fields.hiddenFields === undefined ? undefined : { fieldIds: fields.hiddenFields },
});

const clashes = (params: { existing: TDeclaredFieldSource; incoming: TDeclaredFieldSource }): string[] =>
  validateNewDeclaredFieldClashes(params).map((error) => error.field);

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
    expect(reason).not.toContain("URL contract");
  });

  test("a link-survey system param is described as the URL contract's own, because it is", () => {
    // `getHiddenFieldsFromSearchParams` never fills a field declared under one of these spellings.
    const reason = reasonFor("lang");

    expect(reason).toContain('"lang"');
    expect(reason).toContain("never filled from the URL");
  });

  test("a case variant is refused by naming the reserved spelling it collides with, not the one sent", () => {
    // A grandfathered `userid` field IS filled by `?userid=` (ENG-2892), so the true statement is about
    // `userId`, the spelling the URL contract reserves: a field of THAT name is never filled.
    const reason = reasonFor("userid");

    expect(reason).toContain('"userId"');
    expect(reason).toContain("never filled from the URL");
  });

  test("a name in both lists takes the URL-contract reason", () => {
    // `source` is the one Tier-1 field that is also a link-survey system param. Both statements are
    // true of it; the stronger one wins.
    const reason = reasonFor("source");

    expect(reason).toContain("URL contract");
    expect(reason).not.toContain("auto-captured system field");
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

// ENG-2933: `PUT /api/v1/management/surveys/{id}` accepted a variable named after one of the survey's
// hidden fields. The editor and v3 both refuse it, and the reconcile cannot catch it (a variable is
// stored under its id, a hidden field under its name), so the name guard is where it belongs.
describe("validateNewDeclaredFieldClashes", () => {
  describe("a new clash is refused", () => {
    test("a variable may not take an existing hidden field's name", () => {
      expect(
        clashes({
          existing: declared({ hiddenFields: ["plan"] }),
          incoming: declared({ hiddenFields: ["plan"], variables: ["plan"] }),
        })
      ).toEqual(["plan"]);
    });

    test("a hidden field may not take an existing variable's name", () => {
      expect(
        clashes({
          existing: declared({ variables: ["score"] }),
          incoming: declared({ variables: ["score"], hiddenFields: ["score"] }),
        })
      ).toEqual(["score"]);
    });

    test("a create may not declare both sides under one name", () => {
      expect(
        clashes({
          existing: {},
          incoming: declared({ variables: ["plan"], hiddenFields: ["plan"] }),
        })
      ).toEqual(["plan"]);
    });

    test("matching is case-insensitive, as in the editor and v3", () => {
      expect(
        clashes({
          existing: declared({ hiddenFields: ["Plan"] }),
          incoming: declared({ hiddenFields: ["Plan"], variables: ["plan"] }),
        })
      ).toEqual(["plan"]);
    });

    test("reports the Duplicate code the editor's hidden-fields card reports for the same clash", () => {
      expect(
        validateNewDeclaredFieldClashes({
          existing: declared({ hiddenFields: ["plan"] }),
          incoming: declared({ hiddenFields: ["plan"], variables: ["plan"] }),
        })
      ).toEqual([{ code: TValidateIdErrorCode.Duplicate, field: "plan" }]);
    });

    test("the error names the side the write introduces", () => {
      // The variable already existed, so the hidden field is the newcomer — and the message should
      // echo the spelling the caller just sent, not the one already stored.
      expect(
        clashes({
          existing: declared({ variables: ["plan"] }),
          incoming: declared({ variables: ["plan"], hiddenFields: ["Plan"] }),
        })
      ).toEqual(["Plan"]);
      expect(
        clashes({
          existing: declared({ hiddenFields: ["plan"] }),
          incoming: declared({ hiddenFields: ["plan"], variables: ["PLAN"] }),
        })
      ).toEqual(["PLAN"]);
    });
  });

  describe("grandfathering", () => {
    // 46 production surveys hold this state (`first_name`, `brand`, `score`, ...). Their plain
    // read-modify-write PUT resends both sides, and a blanket refusal would break every one of them.
    const holdsClash = declared({ variables: ["first_name", "score"], hiddenFields: ["first_name", "plan"] });

    test("a survey that already holds the clash may resend it", () => {
      expect(clashes({ existing: holdsClash, incoming: holdsClash })).toEqual([]);
    });

    test("grandfathering survives a case change on either side", () => {
      expect(
        clashes({
          existing: declared({ variables: ["First_Name"], hiddenFields: ["first_name"] }),
          incoming: declared({ variables: ["first_name"], hiddenFields: ["FIRST_NAME"] }),
        })
      ).toEqual([]);
    });

    test("a grandfathered clash does not license a new one", () => {
      expect(
        clashes({
          existing: holdsClash,
          incoming: declared({
            variables: ["first_name", "score", "plan"],
            hiddenFields: ["first_name", "plan"],
          }),
        })
      ).toEqual(["plan"]);
    });

    test("the reprieve is per pair: a name that is only a variable today is not grandfathered as a clash", () => {
      // `score` is declared (as a variable), so the reserved-name guard would grandfather it — but
      // no hidden field shares it yet, so adding one is a NEW clash.
      expect(
        clashes({
          existing: holdsClash,
          incoming: declared({
            variables: ["first_name", "score"],
            hiddenFields: ["first_name", "plan", "score"],
          }),
        })
      ).toEqual(["score"]);
    });

    test("dropping one side spends the reprieve", () => {
      // The save that drops the variable passes; after it the survey no longer holds the clash, so
      // adding the variable back is refused like any new clash.
      expect(
        clashes({
          existing: holdsClash,
          incoming: declared({ variables: ["score"], hiddenFields: ["first_name", "plan"] }),
        })
      ).toEqual([]);
      expect(
        clashes({
          existing: declared({ variables: ["score"], hiddenFields: ["first_name", "plan"] }),
          incoming: declared({ variables: ["score", "first_name"], hiddenFields: ["first_name", "plan"] }),
        })
      ).toEqual(["first_name"]);
    });
  });

  describe("what the write leaves in place", () => {
    test("a carrier the payload never mentions is the survey's current one", () => {
      // The reconcile carries an unmentioned carrier's rows over unchanged, so a payload that sends
      // only `variables` still ends up beside the hidden fields it did not mention.
      expect(
        clashes({
          existing: declared({ hiddenFields: ["plan"] }),
          incoming: declared({ variables: ["plan"] }),
        })
      ).toEqual(["plan"]);
      expect(
        clashes({
          existing: declared({ variables: ["plan"] }),
          incoming: declared({ hiddenFields: ["plan"] }),
        })
      ).toEqual(["plan"]);
    });

    test("a null carrier is treated as unmentioned, not as empty", () => {
      expect(
        clashes({
          existing: declared({ hiddenFields: ["plan"] }),
          incoming: { variables: declared({ variables: ["plan"] }).variables, hiddenFields: null },
        })
      ).toEqual(["plan"]);
    });

    test("moving a name across namespaces in one write is not a clash", () => {
      // Hidden field `plan` becomes variable `plan`: after the write only one field carries the name.
      expect(
        clashes({
          existing: declared({ hiddenFields: ["plan"] }),
          incoming: declared({ hiddenFields: [], variables: ["plan"] }),
        })
      ).toEqual([]);
    });

    test("distinct names never clash", () => {
      expect(
        clashes({
          existing: {},
          incoming: declared({ variables: ["score", "tier"], hiddenFields: ["plan", "user_region"] }),
        })
      ).toEqual([]);
    });
  });
});

describe("validateNewDeclaredFields", () => {
  test("reports reserved names and clashes together", () => {
    expect(
      validateNewDeclaredFields({
        existing: {},
        incoming: declared({ variables: ["country", "plan"], hiddenFields: ["plan"] }),
      })
    ).toEqual([
      { code: TValidateIdErrorCode.Reserved, field: "country" },
      { code: TValidateIdErrorCode.Duplicate, field: "plan" },
    ]);
  });

  test("a name refused as reserved is not reported a second time as a clash", () => {
    const errors = validateNewDeclaredFields({
      existing: {},
      incoming: declared({ variables: ["country"], hiddenFields: ["country"] }),
    });

    expect(errors).toEqual([{ code: TValidateIdErrorCode.Reserved, field: "country" }]);
  });

  test("grandfathers a reserved name and a clash the survey already holds", () => {
    const survey = declared({ variables: ["country", "first_name"], hiddenFields: ["first_name"] });

    expect(validateNewDeclaredFields({ existing: survey, incoming: survey })).toEqual([]);
  });

  test("the clash sentence says what is wrong without claiming the other side came first", () => {
    const [error] = validateNewDeclaredFields({
      existing: {},
      incoming: declared({ variables: ["plan"], hiddenFields: ["plan"] }),
    });

    expect(describeDeclaredFieldNameError(error)).toBe(
      'Field name "plan" cannot be used: a second field in this survey would carry that name, and recall and logic address fields by name.'
    );
  });
});
