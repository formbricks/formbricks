import { describe, expect, test } from "vitest";
import { FORBIDDEN_IDS, RESERVED_DECLARED_FIELD_NAMES } from "@formbricks/types/surveys/validation";
import { getHiddenFieldsFromSearchParams } from "./hidden-fields";

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

  describe("reserved params are never captured", () => {
    // `ZSurveyHiddenFields` rejects reserved names case-sensitively, so `Verify` and `UserId` are
    // names an already-stored survey can hold (the editor now refuses to create them).
    // Case-insensitive matching must not let them harvest the real reserved params - `?verify=<jwt>`
    // is the email-verification credential.
    test("does not capture the email-verification token via a case-variant field name", () => {
      const params = new URLSearchParams("verify=eyJhbGciOiJIUzI1NiJ9.token");

      expect(getHiddenFieldsFromSearchParams(["Verify"], params)).toEqual({});
    });

    test("does not capture userId via a case-variant field name", () => {
      const params = new URLSearchParams("userid=user-123");

      expect(getHiddenFieldsFromSearchParams(["UserId"], params)).toEqual({});
      expect(getHiddenFieldsFromSearchParams(["USERID"], params)).toEqual({});
      expect(getHiddenFieldsFromSearchParams(["UserID"], params)).toEqual({});
    });

    test("blocks every FORBIDDEN_ID in any casing, including an exact-case match", () => {
      for (const forbiddenId of FORBIDDEN_IDS) {
        const lowercased = forbiddenId.toLowerCase();
        const uppercased = forbiddenId.toUpperCase();
        const params = new URLSearchParams();
        params.set(lowercased, "leaked");
        params.set(uppercased, "leaked");
        params.set(forbiddenId, "leaked");

        expect(getHiddenFieldsFromSearchParams([lowercased], params)).toEqual({});
        expect(getHiddenFieldsFromSearchParams([uppercased], params)).toEqual({});
        expect(getHiddenFieldsFromSearchParams([forbiddenId], params)).toEqual({});
      }
    });

    test("blocks the link-survey system params in any casing", () => {
      // Camel-cased on purpose: these are the spellings the runtime actually uses in a URL, and the
      // shared list stores them lowercased.
      for (const systemParam of [
        "suToken",
        "lang",
        "preview",
        "startAt",
        "skipPrefilled",
        "offlineSupport",
      ]) {
        const params = new URLSearchParams();
        params.set(systemParam, "leaked");
        params.set(systemParam.toLowerCase(), "leaked");

        expect(getHiddenFieldsFromSearchParams([systemParam], params)).toEqual({});
        expect(getHiddenFieldsFromSearchParams([systemParam.toLowerCase()], params)).toEqual({});
      }
    });

    // The guard and `validateId` now read the same set, so iterating it here means a name added to
    // one end can never be silently capturable at the other.
    test("blocks every name in the shared reserved set", () => {
      for (const reserved of RESERVED_DECLARED_FIELD_NAMES) {
        const params = new URLSearchParams();
        params.set(reserved, "leaked");
        params.set(reserved.toUpperCase(), "leaked");

        expect(getHiddenFieldsFromSearchParams([reserved], params)).toEqual({});
        expect(getHiddenFieldsFromSearchParams([reserved.toUpperCase()], params)).toEqual({});
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
