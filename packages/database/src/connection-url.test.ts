import { describe, expect, test } from "vitest";
import { joinConnectionUrl, lastParam, splitConnectionUrl } from "./connection-url";

describe("connection URL query rewriting", () => {
  test.each([
    "postgresql://u:p@db:5432/app",
    "postgresql://u:p@db:5432/app?sslmode=require",
    "postgresql://u:p@db:5432/app#frag",
    "postgresql://u:p@db:5432/app?sslmode=require#frag",
    "socket://u:p@/var/run/postgresql?db=app",
  ])("round-trips %s unchanged", (url) => {
    expect(joinConnectionUrl(splitConnectionUrl(url))).toBe(url);
  });

  test("splits the base, query and fragment", () => {
    const parts = splitConnectionUrl("postgresql://u:p@db/app?a=1&b=2#f");

    expect(parts.base).toBe("postgresql://u:p@db/app");
    expect(Object.fromEntries(parts.params)).toEqual({ a: "1", b: "2" });
    expect(parts.fragment).toBe("#f");
  });

  test("adds a query to a URL that had none, before its fragment", () => {
    const parts = splitConnectionUrl("postgresql://u:p@db/app#f");
    parts.params.set("sslmode", "require");

    expect(joinConnectionUrl(parts)).toBe("postgresql://u:p@db/app?sslmode=require#f");
  });

  test("drops the question mark when every parameter is removed", () => {
    const parts = splitConnectionUrl("postgresql://u:p@db/app?sslaccept=strict");
    parts.params.delete("sslaccept");

    expect(joinConnectionUrl(parts)).toBe("postgresql://u:p@db/app");
  });

  test("lastParam returns a repeated parameter's last value, or null", () => {
    const { params } = splitConnectionUrl("postgresql://db/app?sslmode=require&sslmode=verify-full");

    expect(lastParam(params, "sslmode")).toBe("verify-full");
    expect(lastParam(params, "sslaccept")).toBeNull();
  });
});
