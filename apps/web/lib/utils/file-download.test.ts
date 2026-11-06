/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { getContentDispositionFileName, saveBlobAsFile } from "./file-download";

describe("getContentDispositionFileName", () => {
  test("reads a quoted file name, as the export route sends it", () => {
    expect(getContentDispositionFileName('attachment; filename="retention-history-org-2030-01-01.csv"')).toBe(
      "retention-history-org-2030-01-01.csv"
    );
  });

  test("reads an unquoted name and unescapes a quoted one", () => {
    expect(getContentDispositionFileName("attachment; filename=history.csv")).toBe("history.csv");
    expect(getContentDispositionFileName(String.raw`attachment; filename="a \"b\".csv"`)).toBe('a "b".csv');
  });

  test("prefers the UTF-8 name, and falls back to the plain one when it can't be decoded", () => {
    expect(
      getContentDispositionFileName(
        "attachment; filename=\"history.csv\"; filename*=UTF-8''Historie%20%C3%BCber.csv"
      )
    ).toBe("Historie über.csv");
    expect(
      getContentDispositionFileName("attachment; filename=\"history.csv\"; filename*=UTF-8''%E0%A4%A")
    ).toBe("history.csv");
  });

  test("keeps only the name when the header carries a path", () => {
    expect(getContentDispositionFileName('attachment; filename="../../etc/history.csv"')).toBe("history.csv");
    expect(getContentDispositionFileName(String.raw`attachment; filename="C:\\temp\\history.csv"`)).toBe(
      "history.csv"
    );
  });

  test("is null when there is no header or no name in it", () => {
    expect(getContentDispositionFileName(null)).toBeNull();
    expect(getContentDispositionFileName("attachment")).toBeNull();
    expect(getContentDispositionFileName('attachment; filename=""')).toBeNull();
    expect(getContentDispositionFileName('attachment; myfilename="nope.csv"')).toBeNull();
  });
});

describe("saveBlobAsFile", () => {
  const { createObjectURL: originalCreate, revokeObjectURL: originalRevoke } = URL;

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("clicks a temporary link to the blob under the given name, then cleans up after itself", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:retention-history");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const clicked: { href: string; download: string; attached: boolean }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download, attached: document.body.contains(this) });
    });

    const blob = new Blob(["a,b\n"], { type: "text/csv" });
    saveBlobAsFile(blob, "history.csv");

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toEqual([{ href: "blob:retention-history", download: "history.csv", attached: true }]);
    expect(document.querySelector("a")).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:retention-history");
  });
});
