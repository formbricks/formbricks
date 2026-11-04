import { describe, expect, test } from "vitest";
import { formatArchiveSize } from "./format-archive-size";

describe("formatArchiveSize", () => {
  test("shows megabytes below a gigabyte and gigabytes above", () => {
    expect(formatArchiveSize(812 * 1024 * 1024, "en-US")).toBe("812 MB");
    expect(formatArchiveSize(3.4 * 1024 * 1024 * 1024, "en-US")).toBe("3.4 GB");
    expect(formatArchiveSize(1.5 * 1024 * 1024, "en-US")).toBe("1.5 MB");
  });
});
