import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { ZCreateSurveyFollowUpFormSchema } from "@/modules/survey/editor/types/survey-follow-up";
import { buildFollowUpFormDefaultValues } from "./form-default-values";

// The real `t` returns the key's translation; the schema only cares that the strings are non-empty.
const t = ((key: string) => `translated:${key}`) as unknown as TFunction;

const build = (defaultValues?: Parameters<typeof buildFollowUpFormDefaultValues>[0]["defaultValues"]) =>
  buildFollowUpFormDefaultValues({
    defaultValues,
    firstEmailSendToOptionId: "jane@acme.com",
    userEmail: "jane@acme.com",
    t,
  });

describe("buildFollowUpFormDefaultValues", () => {
  test("a fresh follow-up saves once the name is typed, with every toggle left alone", () => {
    // This is the scenario the deleted Playwright steps guarded: name filled in, all three toggles
    // left off, Save. The form validates with `mode: "onChange"`, so a default that fails the schema
    // makes Save do nothing at all and show no error — the #7218 bug.
    const values = { ...build(), followUpName: "Thank you email" };

    expect(ZCreateSurveyFollowUpFormSchema.safeParse(values).success).toBe(true);
  });

  test("the name is the only thing a fresh form is missing", () => {
    // Guards the inverse: if some other field regressed to undefined or an empty string, this would
    // report it alongside `followUpName` instead of the assertion above simply going red.
    const result = ZCreateSurveyFollowUpFormSchema.safeParse(build());

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(["followUpName"]);
  });

  test("leaves the three optional-looking toggles as booleans, never undefined", () => {
    // These are `z.boolean()` in the schema — required, not optional. #7218 shipped
    // `includeVariables` and `includeHiddenFields` missing from the defaults, so they arrived as
    // `undefined` and every save silently failed.
    const values = build();

    expect(values.attachResponseData).toBe(false);
    expect(values.includeVariables).toBe(false);
    expect(values.includeHiddenFields).toBe(false);
  });

  test("defaults still parse when the toggles are explicitly off", () => {
    const values = build({
      followUpName: "Thank you email",
      attachResponseData: false,
      includeVariables: false,
      includeHiddenFields: false,
    });

    expect(ZCreateSurveyFollowUpFormSchema.safeParse(values).success).toBe(true);
  });

  test("an existing follow-up's stored values are carried through", () => {
    const values = build({
      followUpName: "Thank you email",
      triggerType: "endings",
      endingIds: ["cvxbnm0000000000000000az"],
      emailTo: "someone@acme.com",
      replyTo: ["reply@acme.com"],
      subject: "Thanks",
      body: "<p>Thanks!</p>",
      attachResponseData: true,
      includeVariables: true,
      includeHiddenFields: true,
    });

    expect(values).toMatchObject({
      followUpName: "Thank you email",
      triggerType: "endings",
      emailTo: "someone@acme.com",
      attachResponseData: true,
      includeVariables: true,
      includeHiddenFields: true,
    });
    expect(ZCreateSurveyFollowUpFormSchema.safeParse(values).success).toBe(true);
  });

  test("falls back to translated copy, never a hardcoded string", () => {
    // The modal's reset path used to build its own defaults with a hardcoded English subject, so a
    // non-English author editing a follow-up with no stored subject got untranslated copy. Both
    // paths go through this builder now.
    const values = build();

    expect(values.subject).toBe("translated:workspace.surveys.edit.follow_ups_modal_action_subject");
    expect(values.body).toMatch(/^translated:/);
  });

  test("falls back to the first recipient option and the current user's email", () => {
    const values = build();

    expect(values.emailTo).toBe("jane@acme.com");
    expect(values.replyTo).toEqual(["jane@acme.com"]);
  });
});
