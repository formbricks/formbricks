import { describe, expect, test } from "vitest";
import {
  MAX_DOMAIN_LABELS,
  buildDomainList,
  checkOverrides,
  checkShrink,
  extractFreeProviderDomains,
  findMatch,
  normalizeDomain,
  parseLineList,
  parsePublicSuffixList,
  summarize,
} from "./lib.mjs";

const psl = parsePublicSuffixList(`
// ===BEGIN ICANN DOMAINS===
com
uk
co.uk
*.ck
!www.ck
// ===BEGIN PRIVATE DOMAINS===
ddns.net
`);

describe("normalizeDomain", () => {
  test("lowercases, trims and strips trailing dots", () => {
    expect(normalizeDomain("  Mailinator.COM.. ")).toBe("mailinator.com");
  });

  test("rejects anything that is not an ASCII hostname", () => {
    for (const raw of ["", "com", "-bad.com", "a..b.com", "exa mple.com", "bücher.de", "a.b/c", undefined]) {
      expect(normalizeDomain(raw)).toBeNull();
    }
  });
});

describe("parseLineList", () => {
  test("skips blank lines and comments", () => {
    expect(parseLineList("# header\na.com\n\n  b.com  \n#c.com\n")).toEqual(["a.com", "b.com"]);
  });
});

describe("parsePublicSuffixList", () => {
  test("matches ICANN, private, wildcard and exception rules", () => {
    expect(psl("co.uk")).toBe(true);
    expect(psl("ddns.net")).toBe(true);
    expect(psl("anything.ck")).toBe(true);
    expect(psl("www.ck")).toBe(false);
    expect(psl("example.co.uk")).toBe(false);
    expect(psl("me.ddns.net")).toBe(false);
  });

  test("refuses an empty list rather than letting every public suffix through", () => {
    expect(() => parsePublicSuffixList("// nothing\n")).toThrow("empty");
  });
});

describe("extractFreeProviderDomains", () => {
  const services = {
    "gmail.com": { type: "mailbox", costs: "free", hosts: ["gmail.com", "googlemail.com"] },
    "comcast.net": { type: "isp", costs: "paid", hosts: ["comcast.net"] },
    simplelogin: { type: "forwarding", costs: "freemium", hosts: ["aleeas.com"] },
    "sitepro.email": { type: "hosting", costs: "paid", hosts: ["sitepro.email"] },
    iana: { type: "reserved", hosts: ["example.com"] },
    "gone.com": { type: "mailbox", costs: "free", discontinued: true, hosts: ["gone.com"] },
    "nohosts.com": { type: "mailbox", costs: "free" },
  };

  test("keeps mailbox, ISP and forwarding hosts; skips hosting, reserved and discontinued", () => {
    expect(extractFreeProviderDomains(services).sort()).toEqual(
      ["aleeas.com", "comcast.net", "gmail.com", "googlemail.com", "nohosts.com"].sort()
    );
  });

  test("fails on an unknown type or cost instead of guessing what it means", () => {
    expect(() => extractFreeProviderDomains({ x: { type: "webmail", hosts: ["x.com"] } })).toThrow(
      "unknown type"
    );
    expect(() =>
      extractFreeProviderDomains({ x: { type: "mailbox", costs: "cheap", hosts: ["x.com"] } })
    ).toThrow("unknown costs");
  });

  test("fails on a malformed or empty document", () => {
    expect(() => extractFreeProviderDomains({})).toThrow("non-empty");
    expect(() => extractFreeProviderDomains([])).toThrow("non-empty");
    expect(() => extractFreeProviderDomains({ x: { type: "mailbox", hosts: "x.com" } })).toThrow("hosts");
  });
});

describe("buildDomainList", () => {
  test("dedupes and sorts, dropping malformed names, public suffixes and over-long names", () => {
    const tooLong = `${"a.".repeat(MAX_DOMAIN_LABELS)}com`;
    const result = buildDomainList(
      ["b.com", "A.com", "a.com.", "ddns.net", "co.uk", "not a domain", tooLong, "x.ddns.net"],
      psl
    );
    expect(result.domains).toEqual(["a.com", "b.com", "x.ddns.net"]);
    expect(result.dropped).toEqual({
      invalid: ["not a domain"],
      publicSuffix: ["co.uk", "ddns.net"],
      tooLong: [tooLong],
    });
  });

  test("keeps a name at exactly the label cap", () => {
    const atCap = `${"a.".repeat(MAX_DOMAIN_LABELS - 1)}com`;
    expect(buildDomainList([atCap], psl).domains).toEqual([atCap]);
  });
});

describe("checkShrink", () => {
  test("allows growth and shrinkage up to the limit", () => {
    expect(checkShrink({ name: "x", previousCount: 100, nextCount: 150, maxRemovedRatio: 0.1 })).toBeNull();
    expect(checkShrink({ name: "x", previousCount: 100, nextCount: 90, maxRemovedRatio: 0.1 })).toBeNull();
  });

  test("fails past the limit, and on an empty upstream even without history", () => {
    expect(checkShrink({ name: "x", previousCount: 100, nextCount: 89, maxRemovedRatio: 0.1 })).toContain(
      "−11%"
    );
    expect(
      checkShrink({ name: "x", previousCount: undefined, nextCount: 0, maxRemovedRatio: 0.5 })
    ).toContain("no domains");
  });

  test("passes the first run, which has nothing to compare against", () => {
    expect(
      checkShrink({ name: "x", previousCount: undefined, nextCount: 5, maxRemovedRatio: 0.1 })
    ).toBeNull();
  });
});

describe("checkOverrides", () => {
  const entry = (domain: string, reason = "because") => ({ domain, reason });

  test("accepts well-formed, disjoint lists", () => {
    expect(
      checkOverrides({ allowed: [entry("good.com")], blocked: [entry("gmail.cz")], isPublicSuffix: psl })
    ).toEqual([]);
  });

  test("rejects contradictions, duplicates, public suffixes, missing reasons and non-normalized names", () => {
    const errors = checkOverrides({
      allowed: [entry("both.com"), entry("Upper.com")],
      blocked: [
        entry("both.com"),
        entry("ddns.net"),
        entry("dup.com"),
        entry("dup.com"),
        entry("x.com", " "),
      ],
      isPublicSuffix: psl,
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("both.com is in both"),
        expect.stringContaining('"Upper.com" is not a lowercase hostname'),
        expect.stringContaining("ddns.net is a public suffix"),
        expect.stringContaining("dup.com is listed twice"),
        expect.stringContaining("x.com needs a reason"),
      ])
    );
  });

  test("rejects a list that is not an array", () => {
    expect(checkOverrides({ allowed: {}, blocked: [], isPublicSuffix: psl })).toEqual([
      expect.stringContaining("expected an array"),
    ]);
  });
});

describe("findMatch", () => {
  test("matches the domain itself or any parent, never a sibling", () => {
    const set = new Set(["mailinator.com"]);
    expect(findMatch("mailinator.com", set)).toBe("mailinator.com");
    expect(findMatch("a.b.mailinator.com", set)).toBe("mailinator.com");
    expect(findMatch("notmailinator.com", set)).toBeNull();
  });
});

describe("summarize", () => {
  test("reports changes, stale local blocks, overridden allows and dropped entries", () => {
    const body = summarize({
      previous: { free: ["gmail.com", "old.com"], disposable: ["burner.com"] },
      next: { free: ["gmail.com", "tuta.io"], disposable: ["burner.com", "new-burner.com"] },
      sources: [{ repo: "o/r", path: "f.txt", commit: "0123456789abcdef", count: 3 }],
      dropped: { publicSuffix: ["ddns.net"], tooLong: [], invalid: [] },
      allowed: [{ domain: "x.burner.com", reason: "r" }],
      blocked: [
        { domain: "tuta.io", reason: "r" },
        { domain: "gmail.cz", reason: "r" },
      ],
    });
    expect(body).toContain("| Free / personal providers | 2 | 2 | 1 | 1 |");
    expect(body).toContain("| Disposable | 1 | 2 | 1 | 0 |");
    expect(body).toContain("**Free providers added:** `tuta.io`");
    expect(body).toContain("**Free providers removed:** `old.com`");
    expect(body).toContain("delete them from `blocked-domains.json`): `tuta.io`");
    expect(body).not.toContain("`gmail.cz`");
    expect(body).toContain("check the reason still holds): `x.burner.com`");
    expect(body).toContain("public suffixes: `ddns.net`");
    expect(body).toContain(
      "[`o/r/f.txt`](https://github.com/o/r/blob/0123456789abcdef/f.txt) | `0123456789`"
    );
  });
});
