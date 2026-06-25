import { describe, expect, test } from "vitest";
import {
  type AuthMethodId,
  getAuthMethodButtonVariant,
  sortAuthMethodsByLastUsed,
} from "./sort-auth-methods";

describe("sortAuthMethodsByLastUsed", () => {
  const methods: AuthMethodId[] = ["Email", "Google", "Github", "Azure", "OpenID", "Saml"];

  test("returns methods unchanged when last used is empty", () => {
    expect(sortAuthMethodsByLastUsed(methods, "")).toEqual(methods);
  });

  test("returns methods unchanged when last used is not in the list", () => {
    expect(sortAuthMethodsByLastUsed(methods, "Unknown")).toEqual(methods);
  });

  test("moves the last used method to the front", () => {
    expect(sortAuthMethodsByLastUsed(methods, "Github")).toEqual([
      "Github",
      "Email",
      "Google",
      "Azure",
      "OpenID",
      "Saml",
    ]);
  });

  test("preserves relative order of non-last-used methods", () => {
    expect(sortAuthMethodsByLastUsed(["Google", "Email", "Azure"], "Azure")).toEqual([
      "Azure",
      "Google",
      "Email",
    ]);
  });
});

describe("getAuthMethodButtonVariant", () => {
  test("returns default for the last used method", () => {
    expect(getAuthMethodButtonVariant("Google", "Google")).toBe("default");
  });

  test("returns secondary for other methods", () => {
    expect(getAuthMethodButtonVariant("Email", "Google")).toBe("secondary");
  });
});
