import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import {
  INVITE_TOKEN_INVALID_ERROR_CODE,
  PASSWORD_COMPROMISED_ERROR_CODE,
  SETUP_TOKEN_INVALID_ERROR_CODE,
  SIGNUP_DISABLED_ERROR_CODE,
  SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE,
} from "@formbricks/types/errors";
import { getSignupErrorPlacement } from "./signup-error";

const t = ((key: string) => `t:${key}`) as unknown as TFunction;

describe("getSignupErrorPlacement", () => {
  test("a sign-up the instance closed after the page rendered toasts translated copy, not the raw code", () => {
    expect(getSignupErrorPlacement(SIGNUP_DISABLED_ERROR_CODE, t)).toEqual({
      toast: "t:auth.signup.signup_disabled",
    });
  });

  test("field-level rejections go under the input that caused them", () => {
    expect(getSignupErrorPlacement(SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE, t)).toEqual({
      field: "email",
      message: "t:auth.signup.company_email_required",
    });
    expect(getSignupErrorPlacement(PASSWORD_COMPROMISED_ERROR_CODE, t)).toEqual({
      field: "password",
      message: "t:auth.password_compromised",
    });
    expect(getSignupErrorPlacement(SETUP_TOKEN_INVALID_ERROR_CODE, t)).toEqual({
      field: "setupToken",
      message: "t:setup.signup.setup_token_invalid",
    });
  });

  test("an invite revoked after the page rendered toasts the invite copy", () => {
    expect(getSignupErrorPlacement(INVITE_TOKEN_INVALID_ERROR_CODE, t)).toEqual({
      toast: "t:auth.invite.invite_not_found_description",
    });
  });

  test("a server message without a stable code is still shown as the toast", () => {
    expect(getSignupErrorPlacement("Something went wrong", t)).toEqual({ toast: "Something went wrong" });
  });

  test("an unplaced code toasts the fallback message, not the code", () => {
    expect(getSignupErrorPlacement("user_not_found", t, "No account for that address")).toEqual({
      toast: "No account for that address",
    });
  });

  test("a placed code ignores the fallback message", () => {
    expect(getSignupErrorPlacement(SIGNUP_DISABLED_ERROR_CODE, t, "raw problem detail")).toEqual({
      toast: "t:auth.signup.signup_disabled",
    });
  });
});
