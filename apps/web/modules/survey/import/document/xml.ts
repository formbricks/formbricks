import { DOMParser, type Element, MIME_TYPE } from "@xmldom/xmldom";
import { surveyImportFileUnreadable } from "../core/errors";
import { SURVEY_IMPORT_XML_MAX_DEPTH, SURVEY_IMPORT_XML_MAX_ELEMENTS } from "../limits";
import { documentLimitExceeded } from "./errors";

/**
 * One XML part of an Office file, parsed into a DOM under the import's XML limits (ENG-6853).
 *
 * The part arrives already capped in size by the zip guard (`core/zip.ts`). Before the DOM parser
 * allocates a node, the raw text is scanned once for its shape: its nesting and its element count are
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

const refuseDtd = () => surveyImportFileUnreadable("The file declares a DTD, which the import does not read");

/** Where the start tag opening at `start` ends (its `>`), quoted attribute values skipped; -1 if never. */
const endOfStartTag = (text: string, start: number): number => {
  let quote = 0;
  for (let index = start + 1; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (quote !== 0) {
      if (code === quote) quote = 0;
    } else if (code === DOUBLE_QUOTE || code === SINGLE_QUOTE) {
      quote = code;
    } else if (code === GT) {
      return index;
    }
  }
  return -1;
};

const unclosed = () => surveyImportFileUnreadable("A part of the file is not well-formed XML");

/**
 * Hold the part's raw text to the XML limits. Only markup is read: comments, CDATA sections and
 * processing instructions are skipped whole. Markup that never closes is refused here, since a lenient
 * reader would read on past it with nothing counted; other malformed markup is left for the parser.
 */
const checkShape = (text: string, part: string): void => {
  let depth = 0;
  let elements = 0;
  let position = text.indexOf("<");

  while (position !== -1) {
    const next = text.charCodeAt(position + 1);
    let end: number;
    if (next === SLASH) {
      depth -= 1;
      end = text.indexOf(">", position);
    } else if (next === QUESTION) {
      end = text.indexOf("?>", position + 2);
      if (end !== -1) end += 1;
    } else if (next === BANG) {
      if (text.startsWith("<!--", position)) {
        end = text.indexOf("-->", position + 4);
        if (end !== -1) end += 2;
      } else if (text.startsWith("<![CDATA[", position)) {
        end = text.indexOf("]]>", position + 9);
        if (end !== -1) end += 2;
      } else {
        // `<!DOCTYPE`, or a declaration that can only appear inside one.
        throw refuseDtd();
      }
    } else {
      elements += 1;
      if (elements > SURVEY_IMPORT_XML_MAX_ELEMENTS) {
        throw documentLimitExceeded(
          "xml_elements",
          `file.${part}`,
          `An XML part must not have more than ${SURVEY_IMPORT_XML_MAX_ELEMENTS} elements`
        );
      }
      end = endOfStartTag(text, position);
      if (end !== -1 && text.charCodeAt(end - 1) !== SLASH) {
        depth += 1;
        if (depth > SURVEY_IMPORT_XML_MAX_DEPTH) {
          throw documentLimitExceeded(
            "xml_depth",
            `file.${part}`,
            `An XML part must not nest more than ${SURVEY_IMPORT_XML_MAX_DEPTH} levels`
          );
        }
      }
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
export const checkDocumentXml = (bytes: Uint8Array, part: string): void => {
  checkShape(decode(bytes), part);
};

/**
 * Parse one XML part (`part` is its name in the archive, for the refusal) into its root element. Throws
 * `SurveyImportInputError` (422): `document_limit_exceeded` past the XML limits, `file_unreadable` for a
 * part that is not well-formed XML or declares a DTD.
 */
export const parseDocumentXml = (bytes: Uint8Array, part: string): Element => {
  const text = decode(bytes);
  checkShape(text, part);
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
