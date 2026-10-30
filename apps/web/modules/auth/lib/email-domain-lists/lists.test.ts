import { describe, expect, test } from "vitest";
import allowedEntries from "./allowed-domains.json";
import blockedEntries from "./blocked-domains.json";
import disposable from "./disposable-domains.json";
import free from "./free-provider-domains.json";
import sources from "./sources.json";

// What the sign-up gate relies on but cannot check cheaply at runtime. The generated lists come from
// scripts/email-domain-lists/refresh.mjs, which enforces the same rules; this catches a hand edit.
type TEntry = { domain: string; reason: string };
// Typed explicitly: TypeScript infers `never[]` for a JSON file holding an empty array.
const allowed: readonly TEntry[] = allowedEntries;
const blocked: readonly TEntry[] = blockedEntries;

const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;

describe.each([
  ["free-provider-domains.json", free],
  ["disposable-domains.json", disposable],
])("%s", (_name, domains) => {
  test("is sorted, unique, lowercase hostnames within the label cap", () => {
    expect(domains.length).toBeGreaterThan(0);
    expect(domains).toEqual([...new Set(domains)].sort());
    for (const domain of domains) {
      expect(domain).toMatch(HOSTNAME);
      expect(domain.split(".").length).toBeLessThanOrEqual(sources.maxDomainLabels);
    }
  });
});

describe("local overrides", () => {
  test.each([
    ["allowed-domains.json", allowed],
    ["blocked-domains.json", blocked],
  ])("%s entries are unique lowercase hostnames with a reason", (_name, entries) => {
    const domains = entries.map((entry) => entry.domain);
    expect(new Set(domains).size).toBe(domains.length);
    for (const entry of entries) {
      expect(entry.domain).toMatch(HOSTNAME);
      expect(entry.reason.trim()).not.toBe("");
    }
  });

  test("no domain is both allowed and blocked", () => {
    const blockedDomains = new Set(blocked.map((entry) => entry.domain));
    expect(allowed.filter((entry) => blockedDomains.has(entry.domain))).toEqual([]);
  });
});
