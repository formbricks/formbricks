import { describe, expect, test } from "vitest";
import { parseResourceScope, summarizeScopes } from "./scope-families";

describe("parseResourceScope", () => {
  test("splits a resource scope into family and level", () => {
    expect(parseResourceScope("feedbackRecords:write")).toEqual({
      family: "feedbackRecords",
      level: "write",
    });
  });

  test("ignores identity scopes, unknown families and malformed values", () => {
    for (const scope of [
      "openid",
      "offline_access",
      "billing:read",
      "surveys:delete",
      "surveys",
      "a:read:x",
    ]) {
      expect(parseResourceScope(scope)).toBeNull();
    }
  });

  test("the audit log has no write level", () => {
    expect(parseResourceScope("audit:write")).toBeNull();
    expect(parseResourceScope("audit:read")).toEqual({ family: "audit", level: "read" });
  });
});

describe("the setup families (ADR 0018)", () => {
  test("account is read-only and workspaces, organizations and members are write-only", () => {
    expect(parseResourceScope("account:read")).toEqual({ family: "account", level: "read" });
    expect(parseResourceScope("account:write")).toBeNull();
    for (const family of ["workspaces", "organizations", "members"]) {
      expect(parseResourceScope(`${family}:write`)).toEqual({ family, level: "write" });
      expect(parseResourceScope(`${family}:read`)).toBeNull();
    }
  });

  test("they summarize as read access for the account and change access for the rest", () => {
    expect(
      summarizeScopes(["account:read", "workspaces:write", "members:write", "organizations:write"])
    ).toEqual({
      write: ["workspaces", "organizations", "members"],
      readOnly: ["account"],
    });
  });
});

describe("summarizeScopes", () => {
  test("write wins over read and families come back in display order", () => {
    expect(
      summarizeScopes(["webhooks:read", "surveys:read", "surveys:write", "openid", "contacts:read"])
    ).toEqual({ write: ["surveys"], readOnly: ["contacts", "webhooks"] });
  });

  test("a write scope on its own still counts as write access", () => {
    expect(summarizeScopes(["workflows:write"])).toEqual({ write: ["workflows"], readOnly: [] });
  });

  test("no resource scopes means no access", () => {
    expect(summarizeScopes(["openid", "profile"])).toEqual({ write: [], readOnly: [] });
  });
});
