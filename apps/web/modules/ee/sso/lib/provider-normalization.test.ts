import { describe, expect, test } from "vitest";
import {
  getLegacySsoProviderAliases,
  getSsoProviderLookupCandidates,
  normalizeSsoProvider,
  resolveAccountProvider,
} from "./provider-normalization";

describe("SSO provider normalization", () => {
  test("normalizes supported provider ids to canonical values", () => {
    expect(normalizeSsoProvider("google")).toBe("google");
    expect(normalizeSsoProvider("github")).toBe("github");
    expect(normalizeSsoProvider("azure-ad")).toBe("azuread");
    expect(normalizeSsoProvider("azuread")).toBe("azuread");
    expect(normalizeSsoProvider("openid")).toBe("openid");
    expect(normalizeSsoProvider("saml")).toBe("saml");
    expect(normalizeSsoProvider("unsupported")).toBeNull();
  });

  test("returns legacy lookup aliases for canonical providers", () => {
    expect(getLegacySsoProviderAliases("azuread")).toEqual(["azure-ad"]);
    expect(getLegacySsoProviderAliases("google")).toEqual([]);
  });

  test("includes canonical and legacy provider ids when searching for linked accounts", () => {
    expect(getSsoProviderLookupCandidates("azuread")).toEqual(["azuread", "azure-ad"]);
    expect(getSsoProviderLookupCandidates("google")).toEqual(["google"]);
  });

  test("resolves NextAuth provider ids to the canonical Account.provider string", () => {
    expect(resolveAccountProvider("azure-ad")).toBe("azuread");
    expect(resolveAccountProvider("google")).toBe("google");
  });

  test("passes unknown providers through unchanged", () => {
    expect(resolveAccountProvider("credentials")).toBe("credentials");
  });
});
