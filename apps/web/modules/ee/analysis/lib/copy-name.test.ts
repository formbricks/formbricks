import { describe, expect, test } from "vitest";
import { copyNamePrefix, nextCopyName } from "./copy-name";

describe("nextCopyName", () => {
  test("takes the first free copy name", () => {
    expect(nextCopyName("NPS", [])).toBe("NPS (copy)");
    expect(nextCopyName("NPS", ["NPS (copy)"])).toBe("NPS (copy 2)");
    expect(nextCopyName("NPS", ["NPS (copy)", "NPS (copy 2)", "NPS (copy 4)"])).toBe("NPS (copy 3)");
  });

  test("names a copy of a copy after the original", () => {
    expect(nextCopyName("NPS (copy)", ["NPS (copy)"])).toBe("NPS (copy 2)");
    expect(nextCopyName("NPS (copy 7)", [])).toBe("NPS (copy)");
  });

  test("leaves a name that merely mentions a copy alone", () => {
    expect(nextCopyName("Copy (copyright)", [])).toBe("Copy (copyright) (copy)");
    expect(copyNamePrefix("NPS (copy 3)")).toBe("NPS (copy");
  });
});
