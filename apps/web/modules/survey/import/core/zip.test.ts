import { randomBytes } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  SURVEY_IMPORT_ZIP_MAX_COMPRESSION_RATIO,
  SURVEY_IMPORT_ZIP_MAX_ENTRIES,
  SURVEY_IMPORT_ZIP_MAX_INFLATED_BYTES,
  SURVEY_IMPORT_ZIP_MAX_PART_BYTES,
} from "../limits";
import type { TSurveyImportFileLimit } from "../types";
import {
  findCentralEntry,
  hexText,
  setDeclaredEntryCount,
  setDeclaredSizes,
  setFlags,
  zipOf,
} from "./__fixtures__/zip-builders";
import { SurveyImportFileTooLargeError, SurveyImportInputError } from "./errors";
import { openZipArchive } from "./zip";

const MiB = 1024 * 1024;

const expectTooLarge = (run: () => unknown, limit: TSurveyImportFileLimit) => {
  let thrown: unknown;
  try {
    run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(SurveyImportFileTooLargeError);
  expect((thrown as SurveyImportFileTooLargeError).invalidParams).toEqual([
    expect.objectContaining({ name: "file", code: "file_limit_exceeded", identifier: limit }),
  ]);
};

const expectUnreadable = (run: () => unknown) => {
  let thrown: unknown;
  try {
    run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(SurveyImportInputError);
  expect((thrown as SurveyImportInputError).invalidParams).toEqual([
    expect.objectContaining({ name: "file", code: "file_unreadable" }),
  ]);
};

describe("openZipArchive, before anything is inflated", () => {
  test("lists the archive's entries in directory order", () => {
    const archive = openZipArchive(
      zipOf({ "[Content_Types].xml": "<Types/>", "word/document.xml": "<w:document/>" })
    );

    expect(archive.names).toEqual(["[Content_Types].xml", "word/document.xml"]);
  });

  test(`takes ${SURVEY_IMPORT_ZIP_MAX_ENTRIES} entries and refuses one more, naming the limit`, () => {
    const entries = (count: number) =>
      Object.fromEntries(Array.from({ length: count }, (_, index) => [`part-${index}.xml`, ""]));

    expect(openZipArchive(zipOf(entries(SURVEY_IMPORT_ZIP_MAX_ENTRIES))).names).toHaveLength(
      SURVEY_IMPORT_ZIP_MAX_ENTRIES
    );
    expectTooLarge(() => openZipArchive(zipOf(entries(SURVEY_IMPORT_ZIP_MAX_ENTRIES + 1))), "zip_entries");
  });

  test("refuses a declared entry count past the limit without walking the directory", () => {
    // One real entry, but the end record claims 65,535: the count alone decides, before any entry is read.
    const archive = setDeclaredEntryCount(zipOf({ "word/document.xml": "<w:document/>" }), 65_535);

    expectTooLarge(() => openZipArchive(archive), "zip_entries");
  });

  test(`takes an entry declared at ${SURVEY_IMPORT_ZIP_MAX_COMPRESSION_RATIO}:1 and refuses one byte more`, () => {
    const archive = zipOf({ "word/media/image1.bin": randomBytes(1000) });
    const { compressedSize } = findCentralEntry(archive, "word/media/image1.bin");
    const atLimit = compressedSize * SURVEY_IMPORT_ZIP_MAX_COMPRESSION_RATIO;

    expect(() =>
      openZipArchive(setDeclaredSizes(archive, "word/media/image1.bin", { uncompressedSize: atLimit }))
    ).not.toThrow();
    expectTooLarge(
      () =>
        openZipArchive(setDeclaredSizes(archive, "word/media/image1.bin", { uncompressedSize: atLimit + 1 })),
      "zip_compression_ratio"
    );
  });

  test("refuses an entry that declares content but no compressed bytes", () => {
    const archive = setDeclaredSizes(zipOf({ "word/document.xml": "" }, 0), "word/document.xml", {
      compressedSize: 0,
      uncompressedSize: 1,
    });

    expectTooLarge(() => openZipArchive(archive), "zip_compression_ratio");
  });

  test("takes 200 MiB declared in total and refuses one byte more", () => {
    // Two stored 1 MiB entries declared at 100:1 make exactly 200 MiB; the third adds the byte.
    const base = zipOf(
      {
        "word/media/a.bin": new Uint8Array(MiB),
        "word/media/b.bin": new Uint8Array(MiB),
        "word/media/c.bin": new Uint8Array(1),
      },
      0
    );
    const declare = (lastBytes: number) =>
      setDeclaredSizes(
        setDeclaredSizes(
          setDeclaredSizes(base, "word/media/a.bin", { uncompressedSize: 100 * MiB }),
          "word/media/b.bin",
          { uncompressedSize: 100 * MiB }
        ),
        "word/media/c.bin",
        { uncompressedSize: lastBytes }
      );
    expect(100 * MiB * 2).toBe(SURVEY_IMPORT_ZIP_MAX_INFLATED_BYTES);

    expect(() => openZipArchive(declare(0))).not.toThrow();
    expectTooLarge(() => openZipArchive(declare(1)), "zip_inflated_size");
  });

  test("takes an XML part declared at 10 MiB and refuses one byte more; other entries are not held to it", () => {
    // Large enough that 10 MiB stays inside the ratio limit.
    const stored = new Uint8Array(Math.ceil(SURVEY_IMPORT_ZIP_MAX_PART_BYTES / 100) + 1);
    const base = zipOf({ "word/document.xml": stored, "word/_rels/document.xml.rels": stored }, 0);
    const declare = (name: string, bytes: number) =>
      setDeclaredSizes(base, name, { uncompressedSize: bytes });

    expect(() =>
      openZipArchive(declare("word/document.xml", SURVEY_IMPORT_ZIP_MAX_PART_BYTES))
    ).not.toThrow();
    expectTooLarge(
      () => openZipArchive(declare("word/document.xml", SURVEY_IMPORT_ZIP_MAX_PART_BYTES + 1)),
      "zip_part_size"
    );
    expectTooLarge(
      () => openZipArchive(declare("word/_rels/document.xml.rels", SURVEY_IMPORT_ZIP_MAX_PART_BYTES + 1)),
      "zip_part_size"
    );

    const media = zipOf({ "word/media/video.bin": stored }, 0);
    expect(() =>
      openZipArchive(
        setDeclaredSizes(media, "word/media/video.bin", {
          uncompressedSize: SURVEY_IMPORT_ZIP_MAX_PART_BYTES + 1,
        })
      )
    ).not.toThrow();
  });

  test("refuses bytes that are not a zip archive, or one cut short, as unreadable", () => {
    const archive = zipOf({ "word/document.xml": "<w:document/>" });

    expectUnreadable(() => openZipArchive(new TextEncoder().encode("PK not really a zip")));
    expectUnreadable(() => openZipArchive(archive.subarray(0, archive.length - 30)));
  });

  test("refuses an entry that says its size is in a ZIP64 field it does not have", () => {
    // The malformed ZIP64 archive that hangs fflate before 0.8.3 (GHSA-px8p-9vwx-vf98).
    const archive = setDeclaredSizes(zipOf({ "word/document.xml": "<w:document/>" }), "word/document.xml", {
      compressedSize: 0xffffffff,
    });

    expectUnreadable(() => openZipArchive(archive));
  });

  test("refuses two entries with the same name, which readers would resolve differently", () => {
    const archive = zipOf({ "word/document.xml": "<a/>", "word/documenX.xml": "<b/>" });
    const renamed = new Uint8Array(archive);
    // Rename the second entry in the directory only, so the directory lists the first name twice.
    const second = findCentralEntry(renamed, "word/documenX.xml");
    renamed[second.nameOffset + "word/documen".length] = "t".charCodeAt(0);

    expectUnreadable(() => openZipArchive(renamed));
  });
});

describe("openZipArchive, reading an entry", () => {
  test("returns the exact bytes of a deflated and a stored entry, and null for a name not in it", () => {
    const text = "<w:document>Wie zufrieden sind Sie?</w:document>".repeat(50);
    const deflated = openZipArchive(zipOf({ "word/document.xml": text }));
    const stored = openZipArchive(zipOf({ "word/document.xml": text }, 0));

    expect(new TextDecoder().decode(deflated.read("word/document.xml") ?? undefined)).toBe(text);
    expect(new TextDecoder().decode(stored.read("word/document.xml") ?? undefined)).toBe(text);
    expect(deflated.read("word/missing.xml")).toBeNull();
  });

  test("counts the inflated bytes: a part takes 10 MiB and is refused one byte past it, whatever it declares", () => {
    const read = (bytes: number) => {
      const archive = setDeclaredSizes(
        zipOf({ "word/document.xml": hexText(bytes) }, 1),
        "word/document.xml",
        {
          // The directory understates the part, so only counting what comes out can catch it.
          uncompressedSize: 1024,
        }
      );
      return () => openZipArchive(archive).read("word/document.xml");
    };

    expectUnreadable(read(SURVEY_IMPORT_ZIP_MAX_PART_BYTES));
    expectTooLarge(read(SURVEY_IMPORT_ZIP_MAX_PART_BYTES + 1), "zip_part_size");
  });

  test("counts the inflated bytes against the compression ratio, whatever the directory declares", () => {
    const archive = setDeclaredSizes(
      zipOf({ "word/document.xml": new Uint8Array(MiB) }),
      "word/document.xml",
      {
        uncompressedSize: 1024,
      }
    );

    expectTooLarge(() => openZipArchive(archive).read("word/document.xml"), "zip_compression_ratio");
  });

  test("refuses an entry that inflates to other than its declared size as unreadable", () => {
    const archive = zipOf({ "word/document.xml": hexText(4000) });
    const declared = findCentralEntry(archive, "word/document.xml");

    expectUnreadable(() =>
      openZipArchive(
        setDeclaredSizes(archive, "word/document.xml", { uncompressedSize: declared.uncompressedSize + 1 })
      ).read("word/document.xml")
    );
  });

  test("refuses damaged compressed data and encrypted entries as unreadable", () => {
    const archive = zipOf({ "word/document.xml": hexText(4000) });
    const damaged = new Uint8Array(archive);
    const entry = findCentralEntry(damaged, "word/document.xml");
    damaged.fill(0xff, entry.dataOffset, entry.dataOffset + 16);

    expectUnreadable(() => openZipArchive(damaged).read("word/document.xml"));
    expectUnreadable(() =>
      openZipArchive(setFlags(archive, "word/document.xml", 0x1)).read("word/document.xml")
    );
  });
});
