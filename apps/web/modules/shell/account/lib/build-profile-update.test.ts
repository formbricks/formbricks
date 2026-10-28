import { describe, expect, test } from "vitest";
import { buildProfileUpdate, requiresPasswordConfirmation } from "./build-profile-update";

const values = { name: "  Mia Fischer ", email: " Mia@Acme.com ", locale: "de-DE" } as const;

describe("buildProfileUpdate", () => {
  test("sends nothing for an untouched form", () => {
    expect(buildProfileUpdate({ values, dirty: {} })).toEqual({});
  });

  test("sends only the changed fields, trimmed", () => {
    expect(buildProfileUpdate({ values, dirty: { name: true } })).toEqual({ name: "Mia Fischer" });
    expect(buildProfileUpdate({ values, dirty: { locale: true } })).toEqual({ locale: "de-DE" });
  });

  test("lower-cases a changed address and attaches the password to it", () => {
    expect(buildProfileUpdate({ values, dirty: { email: true }, password: "Secret123" })).toEqual({
      email: "mia@acme.com",
      password: "Secret123",
    });
  });

  test("never attaches the password to an edit that leaves the address alone", () => {
    expect(buildProfileUpdate({ values, dirty: { name: true }, password: "Secret123" })).not.toHaveProperty(
      "password"
    );
  });
});

describe("requiresPasswordConfirmation", () => {
  test("is true only when the address changed", () => {
    expect(requiresPasswordConfirmation({ email: true })).toBe(true);
    expect(requiresPasswordConfirmation({ name: true, locale: true })).toBe(false);
    expect(requiresPasswordConfirmation({})).toBe(false);
  });
});
