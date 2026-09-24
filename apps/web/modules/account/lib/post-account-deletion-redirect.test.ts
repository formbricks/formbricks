import { describe, expect, test } from "vitest";
import {
  ACCOUNT_DELETED_PATH,
  FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL,
} from "@/modules/account/constants";
import { getPostAccountDeletionRedirectUrl } from "./post-account-deletion-redirect";

describe("getPostAccountDeletionRedirectUrl", () => {
  test("sends a deleted Cloud account to the offboarding survey", () => {
    expect(getPostAccountDeletionRedirectUrl(true)).toBe(FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL);
  });

  test("sends a deleted self-hosted account to the login page", () => {
    expect(getPostAccountDeletionRedirectUrl(false)).toBe("/auth/login");
  });
});

describe("ACCOUNT_DELETED_PATH", () => {
  // The whole point of the constant (ENG-3260). It is handed to Better Auth's `delete-user/callback` as
  // the `callbackURL`, where `originCheck` accepts a relative path on any deployment but an absolute URL
  // only when it is a trustedOrigin — so making this absolute breaks the emailed SSO deletion link
  // everywhere the URL does not name. The deployment-specific destination belongs in
  // `getPostAccountDeletionRedirectUrl`, which is only ever navigated to from the browser.
  test("is a relative path, so the emailed deletion link survives originCheck on every deployment", () => {
    expect(ACCOUNT_DELETED_PATH.startsWith("/")).toBe(true);
    expect(ACCOUNT_DELETED_PATH.startsWith("//")).toBe(false); // protocol-relative is cross-origin too
    expect(() => new URL(ACCOUNT_DELETED_PATH)).toThrow(); // no scheme + host of its own
  });
});
