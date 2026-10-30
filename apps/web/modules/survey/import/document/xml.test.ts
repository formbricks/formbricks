import { describe, expect, test } from "vitest";
import { SurveyImportInputError } from "../core/errors";
import { SURVEY_IMPORT_XML_MAX_DEPTH, SURVEY_IMPORT_XML_MAX_ELEMENTS } from "../limits";
import { parseDocumentXml } from "./xml";

const encode = (text: string) => new TextEncoder().encode(text);

const parse = (text: string) => parseDocumentXml(encode(text), "word/document.xml");

const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    if (error instanceof SurveyImportInputError) return error.invalidParams[0];
    throw error;
  }
  throw new Error("Expected the part to be refused");
};

/** A root element nesting `depth` levels in all, the root included. */
const nested = (depth: number) => `${"<a>".repeat(depth)}${"</a>".repeat(depth)}`;

/** A root element holding `count - 1` empty children: `count` elements in all. */
const flat = (count: number) => `<r>${"<a/>".repeat(count - 1)}</r>`;

describe("parseDocumentXml", () => {
  test("parses a part into its root element, attributes with `>` in their values included", () => {
    const root = parse(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:p xmlns:w="urn:w"><w:t a="x > y">Q1 &amp; Q2</w:t></w:p>`
    );

    expect(root.localName).toBe("p");
    expect(root.textContent).toBe("Q1 & Q2");
  });

  test("takes exactly the nesting limit and refuses one level more, naming the part", () => {
    expect(parse(nested(SURVEY_IMPORT_XML_MAX_DEPTH)).localName).toBe("a");
    expect(refusal(() => parse(nested(SURVEY_IMPORT_XML_MAX_DEPTH + 1)))).toEqual({
      name: "file.word/document.xml",
      reason: `An XML part must not nest more than ${SURVEY_IMPORT_XML_MAX_DEPTH} levels`,
      code: "document_limit_exceeded",
      identifier: "xml_depth",
    });
  });

  test("takes exactly the element limit and refuses one element more", () => {
    expect(parse(flat(SURVEY_IMPORT_XML_MAX_ELEMENTS)).childNodes).toHaveLength(
      SURVEY_IMPORT_XML_MAX_ELEMENTS - 1
    );
    expect(refusal(() => parse(flat(SURVEY_IMPORT_XML_MAX_ELEMENTS + 1)))).toMatchObject({
      code: "document_limit_exceeded",
      identifier: "xml_elements",
    });
  });

  test("does not count comments, CDATA or processing instructions as elements or levels", () => {
    // At the nesting limit already: markup-looking text inside them would push the part past it.
    const levels = SURVEY_IMPORT_XML_MAX_DEPTH;
    const text = `${"<a>".repeat(levels)}<!-- <a><a> --><![CDATA[<a><a>]]><?pi <a>?>${"</a>".repeat(levels)}`;

    expect(parse(text).localName).toBe("a");
  });

  test("refuses a part that declares a DTD, so no entity is ever defined or expanded", () => {
    const billionLaughs = `<?xml version="1.0"?><!DOCTYPE r [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;">]><r>&b;</r>`;
    const external = `<?xml version="1.0"?><!DOCTYPE r SYSTEM "file:///etc/passwd"><r/>`;

    for (const text of [billionLaughs, external]) {
      expect(refusal(() => parse(text))).toMatchObject({ code: "file_unreadable" });
    }
  });

  test("refuses a part that is not well-formed XML as unreadable", () => {
    for (const text of ["<r><a></r>", "", "not xml", "<r>&undefined;</r>"]) {
      expect(refusal(() => parse(text))).toMatchObject({ code: "file_unreadable" });
    }
  });

  test("refuses a part that is not UTF-8 as unreadable", () => {
    expect(
      refusal(() =>
        parseDocumentXml(new Uint8Array([0x3c, 0x72, 0x3e, 0xff, 0x3c, 0x2f, 0x72, 0x3e]), "x.xml")
      )
    ).toMatchObject({ code: "file_unreadable" });
  });
});
