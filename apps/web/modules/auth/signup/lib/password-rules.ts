import { ZUserPassword } from "@formbricks/types/user";

export interface PasswordRules {
  length: boolean;
  uppercase: boolean;
  number: boolean;
}

/**
 * The three conditions `ZUserPassword` enforces (8 to 128 characters, an uppercase letter, a digit),
 * evaluated one by one so a form can show which are still open. Mixed case is not required: the
 * schema asks for an uppercase letter and a digit, nothing more.
 */
export const getPasswordRules = (password: string): PasswordRules => ({
  length: password.length >= 8 && password.length <= 128,
  uppercase: /[A-Z]/.test(password),
  number: /\d/.test(password),
});

/** True exactly when `ZUserPassword` accepts the password, i.e. when every rule above holds. */
export const isPasswordAcceptable = (password: string): boolean => ZUserPassword.safeParse(password).success;
