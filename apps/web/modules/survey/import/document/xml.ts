import { DOMParser, type Element, MIME_TYPE } from "@xmldom/xmldom";
import { surveyImportFileUnreadable } from "../core/errors";
import {
  SURVEY_IMPORT_XML_MAX_ATTRIBUTES,
  SURVEY_IMPORT_XML_MAX_DEPTH,
  SURVEY_IMPORT_XML_MAX_ELEMENTS,
} from "../limits";
import { documentLimitExceeded } from "./errors";

/**
 * One XML part of an Office file, parsed into a DOM under the import's XML limits (ENG-6853).
 *
 * The part arrives already capped in size by the zip guard (`core/zip.ts`). Before the DOM parser
 * allocates a node, the raw text is scanned once for its shape: its nesting, elements and attributes are
 * held to the XML limits, and a part that declares a DTD is refused, so no entity is ever defined,
 * expanded or fetched (Office never writes one). Only then does @xmldom/xmldom parse it, with every
 * error fatal: a part that is not well-formed is unreadable, never half-read.
 */

const GT = 0x3e;
const SLASH = 0x2f;
const QUESTION = 0x3f;
const BANG = 0x21;
const DOUBLE_QUOTE = 0x22;
const SINGLE_QUOTE = 0x27;
const EQUALS = 0x3d;

const refuseDtd = () => surveyImportFileUnreadable("The file declares a DTD, which the import does not read");

/**
 * Where the start tag opening at `start` ends (its `>`), quoted attribute values skipped; -1 if never.
 * Calls `onAttribute` for each attribute, by its `=`, the one place an `=` can stand outside a value.
 */
const endOfStartTag = (text: string, start: number, onAttribute: () => void): number => {
  let quote = 0;
  for (let index = start + 1; index < text.length; index += 1) {
    const code = text.codePointAt(index);
    if (quote !== 0) {
      if (code === quote) quote = 0;
    } else if (code === DOUBLE_QUOTE || code === SINGLE_QUOTE) {
      quote = code;
    } else if (code === EQUALS) {
      onAttribute();
    } else if (code === GT) {
      return index;
    }
  }
  return -1;
};

const unclosed = () => surveyImportFileUnreadable("A part of the file is not well-formed XML");

/**
 * What one file's XML parts may still hold together: its elements and attributes, drawn down as each part
 * is read, so a file cannot reach the limits many times over by splitting its markup across parts, or by
 * pointing several relationships at one part. One budget per file; a part read alone gets its own.
 */
export interface TXmlBudget {
  elements: number;
  attributes: number;
}

const XML_BUDGET_MAX = {
  elements: SURVEY_IMPORT_XML_MAX_ELEMENTS,
  attributes: SURVEY_IMPORT_XML_MAX_ATTRIBUTES,
} as const;

export const createXmlBudget = (): TXmlBudget => ({ ...XML_BUDGET_MAX });

/** Take one element or attribute from the file's budget, refusing the file once it is spent. */
const spend = (budget: TXmlBudget, kind: keyof TXmlBudget, part: string): void => {
  budget[kind] -= 1;
  if (budget[kind] < 0) {
    throw documentLimitExceeded(
      `xml_${kind}`,
      `file.${part}`,
      `A file's XML must not have more than ${XML_BUDGET_MAX[kind]} ${kind} in all`
    );
  }
};

/** Markup read past whole, as an opening and the closing that ends it. */
const SKIPPED_MARKUP = [
  ["<?", "?>"],
  ["<!--", "-->"],
  ["<![CDATA[", "]]>"],
] as const;

/**
 * Where the processing instruction, comment or CDATA section at `position` ends (its last character),
 * or -1 when it never does. Any other `<!` is a DTD, or a declaration that can only appear inside one.
 */
const endOfSkippedMarkup = (text: string, position: number): number => {
  for (const [open, close] of SKIPPED_MARKUP) {
    if (text.startsWith(open, position)) {
      const end = text.indexOf(close, position + open.length);
      return end === -1 ? -1 : end + close.length - 1;
    }
  }
  throw refuseDtd();
};

/** One level deeper, refusing the part past the XML depth limit. */
const deeper = (depth: number, part: string): number => {
  if (depth + 1 > SURVEY_IMPORT_XML_MAX_DEPTH) {
    throw documentLimitExceeded(
      "xml_depth",
      `file.${part}`,
      `An XML part must not nest more than ${SURVEY_IMPORT_XML_MAX_DEPTH} levels`
    );
  }
  return depth + 1;
};

/**
 * Hold the part's raw text to the XML limits. Only markup is read: comments, CDATA sections and
 * processing instructions are skipped whole. Markup that never closes is refused here, since a lenient
 * reader would read on past it with nothing counted, and so is a close tag with nothing open, which would
 * credit the depth count; other malformed markup is left for the parser.
 */
const checkShape = (text: string, part: string, budget: TXmlBudget): void => {
  let depth = 0;
  const countAttribute = () => spend(budget, "attributes", part);
  let position = text.indexOf("<");

  while (position !== -1) {
    const next = text.codePointAt(position + 1);
    let end: number;
    if (next === SLASH) {
      // A close tag with nothing open is not XML, and would leave depth below zero to spend later.
      if (depth === 0) throw unclosed();
      depth -= 1;
      end = text.indexOf(">", position);
    } else if (next === QUESTION || next === BANG) {
      end = endOfSkippedMarkup(text, position);
    } else {
      spend(budget, "elements", part);
      end = endOfStartTag(text, position, countAttribute);
      // A start tag that isn't self-closing opens a level.
      if (end !== -1 && text.codePointAt(end - 1) !== SLASH) depth = deeper(depth, part);
    }
    if (end === -1) throw unclosed();
    position = text.indexOf("<", end + 1);
  }
};

/** The part's text: UTF-16 when a byte-order mark says so, else UTF-8 (a mark dropped), as XML allows. */
const decode = (bytes: Uint8Array): string => {
  let encoding = "utf-8";
  if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = "utf-16le";
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = "utf-16be";
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw surveyImportFileUnreadable("A part of the file is not valid text");
  }
};

const failOnError = (level: "warning" | "error" | "fatalError"): void => {
  if (level !== "warning") throw new Error(level);
};

/**
 * Hold one XML part to the XML limits without parsing it: its nesting, its element count, no DTD. For a
 * reader that parses the part itself, such as SheetJS, which applies none of them (`read-sheet.ts`).
 * Throws what {@link parseDocumentXml} throws for the same part, short of a malformed one.
 */
export const checkDocumentXml = (bytes: Uint8Array, part: string, budget = createXmlBudget()): void => {
  checkShape(decode(bytes), part, budget);
};

/**
 * Parse one XML part (`part` is its name in the archive, for the refusal) into its root element. Throws
 * `SurveyImportInputError` (422): `document_limit_exceeded` past the XML limits, `file_unreadable` for a
 * part that is not well-formed XML or declares a DTD.
 */
export const parseDocumentXml = (bytes: Uint8Array, part: string, budget = createXmlBudget()): Element => {
  const text = decode(bytes);
  checkShape(text, part, budget);
  let root: Element | null;
  try {
    root = new DOMParser({ onError: failOnError }).parseFromString(
      text,
      MIME_TYPE.XML_APPLICATION
    ).documentElement;
  } catch {
    throw surveyImportFileUnreadable("A part of the file is not well-formed XML");
  }
  if (!root) throw surveyImportFileUnreadable("A part of the file is not well-formed XML");
  return root;
};
