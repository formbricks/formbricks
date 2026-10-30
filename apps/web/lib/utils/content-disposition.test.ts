import { describe, expect, test } from "vitest";
import {
  DOWNLOAD_FILE_NAME_MAX_BYTES,
  buildAttachmentContentDisposition,
  buildDownloadFileName,
} from "./content-disposition";
import { getContentDispositionFileName } from "./file-download";

const EXTENSION = ".formbricks.json";
const FALLBACK = "survey";

const utf8Bytes = (value: string): number => new TextEncoder().encode(value).length;

describe("buildDownloadFileName", () => {
  test("keeps a readable name as it is, Latin or not", () => {
    expect(buildDownloadFileName("Onboarding NPS", EXTENSION, FALLBACK)).toBe(
      "Onboarding NPS.formbricks.json"
    );
    expect(buildDownloadFileName("Größe der Kundenzufriedenheit", ".xlsx", FALLBACK)).toBe(
      "Größe der Kundenzufriedenheit.xlsx"
    );
    expect(buildDownloadFileName("استبيان العملاء", EXTENSION, FALLBACK)).toBe(
      "استبيان العملاء.formbricks.json"
    );
  });

  test("removes path separators and the characters Windows refuses in a name", () => {
    expect(buildDownloadFileName(String.raw`Q1/Q2 \ results: "final"? <a>|*`, EXTENSION, FALLBACK)).toBe(
      "Q1Q2 results final a.formbricks.json"
    );
    expect(buildDownloadFileName("../../etc/passwd", EXTENSION, FALLBACK)).toBe("etcpasswd.formbricks.json");
  });

  test("removes control and bidirectional-override characters, so a name cannot fake its extension", () => {
    expect(buildDownloadFileName("tab\there\u0000\u001f\u007f\u0085", EXTENSION, FALLBACK)).toBe(
      "tab here.formbricks.json"
    );
    expect(buildDownloadFileName("broken\uD800 name", EXTENSION, FALLBACK)).toBe(
      "broken name.formbricks.json"
    );
    expect(buildDownloadFileName("invoice\u202Egpj.exe", EXTENSION, FALLBACK)).toBe(
      "invoicegpj.exe.formbricks.json"
    );
  });

  test("trims leading and trailing dots and spaces, and collapses runs of whitespace", () => {
    expect(buildDownloadFileName("  .hidden survey. . ", EXTENSION, FALLBACK)).toBe(
      "hidden survey.formbricks.json"
    );
    expect(buildDownloadFileName("a   \n  b", EXTENSION, FALLBACK)).toBe("a b.formbricks.json");
  });

  test("escapes the device names Windows reserves, whatever their case or extension", () => {
    expect(buildDownloadFileName("CON", EXTENSION, FALLBACK)).toBe("_CON.formbricks.json");
    expect(buildDownloadFileName("lpt9", EXTENSION, FALLBACK)).toBe("_lpt9.formbricks.json");
    expect(buildDownloadFileName("nul.backup", EXTENSION, FALLBACK)).toBe("_nul.backup.formbricks.json");
    expect(buildDownloadFileName("Console", EXTENSION, FALLBACK)).toBe("Console.formbricks.json");
  });

  test("falls back to the given name when nothing readable is left", () => {
    expect(buildDownloadFileName("///", EXTENSION, FALLBACK)).toBe("survey.formbricks.json");
    expect(buildDownloadFileName(" . ", EXTENSION, FALLBACK)).toBe("survey.formbricks.json");
    expect(buildDownloadFileName("", EXTENSION, FALLBACK)).toBe("survey.formbricks.json");
  });

  test(`caps the whole name at ${DOWNLOAD_FILE_NAME_MAX_BYTES} UTF-8 bytes without splitting a character`, () => {
    const exactlyAtCap = "a".repeat(DOWNLOAD_FILE_NAME_MAX_BYTES - EXTENSION.length);
    expect(buildDownloadFileName(exactlyAtCap, EXTENSION, FALLBACK)).toBe(`${exactlyAtCap}${EXTENSION}`);
    expect(buildDownloadFileName(`${exactlyAtCap}b`, EXTENSION, FALLBACK)).toBe(
      `${exactlyAtCap}${EXTENSION}`
    );

    for (const character of ["ü", "日", "😀"]) {
      const fileName = buildDownloadFileName(character.repeat(300), EXTENSION, FALLBACK);
      expect(utf8Bytes(fileName)).toBeLessThanOrEqual(DOWNLOAD_FILE_NAME_MAX_BYTES);
      expect(fileName.endsWith(EXTENSION)).toBe(true);
      expect(fileName.slice(0, -EXTENSION.length).replaceAll(character, "")).toBe("");
    }
  });

  test("trims a dot or space the cap leaves at the end of the name", () => {
    const name = `${"a".repeat(DOWNLOAD_FILE_NAME_MAX_BYTES - EXTENSION.length - 1)} b`;
    expect(buildDownloadFileName(name, EXTENSION, FALLBACK)).toBe(
      `${"a".repeat(DOWNLOAD_FILE_NAME_MAX_BYTES - EXTENSION.length - 1)}${EXTENSION}`
    );
  });
});

describe("buildAttachmentContentDisposition", () => {
  test("sends an ASCII name as both the fallback and the UTF-8 parameter", () => {
    expect(buildAttachmentContentDisposition("Onboarding NPS.formbricks.json")).toBe(
      `attachment; filename="Onboarding NPS.formbricks.json"; filename*=UTF-8''Onboarding%20NPS.formbricks.json`
    );
  });

  test("gives a non-Latin name an ASCII fallback and the exact name in filename*", () => {
    const header = buildAttachmentContentDisposition("Größe Umfrage.formbricks.json");
    expect(header).toBe(
      `attachment; filename="Gro_e Umfrage.formbricks.json"; filename*=UTF-8''Gr%C3%B6%C3%9Fe%20Umfrage.formbricks.json`
    );

    const arabic = buildAttachmentContentDisposition("استبيان العملاء.formbricks.json");
    const fallback = /filename="([^"]*)"/.exec(arabic)?.[1] ?? "";
    expect(fallback).toBe("_ _.formbricks.json");
    expect(getContentDispositionFileName(arabic)).toBe("استبيان العملاء.formbricks.json");
  });

  test("never puts a quote, backslash or percent sign in the fallback, and percent-encodes RFC 8187's reserved marks", () => {
    const header = buildAttachmentContentDisposition(String.raw`it's "100%" \(done)*.json`);
    const fallback = /filename="([^"]*)"/.exec(header)?.[1];
    expect(fallback).toBe("it's _100__ _(done)*.json");
    expect(header).toContain(`filename*=UTF-8''it%27s%20%22100%25%22%20%5C%28done%29%2A.json`);
  });
});
