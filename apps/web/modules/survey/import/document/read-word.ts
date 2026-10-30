import type { Element, Node } from "@xmldom/xmldom";
import { surveyImportFileUnreadable } from "../core/errors";
import type { TZipArchive } from "../core/zip";
import {
  SURVEY_IMPORT_WORD_MAX_PARAGRAPHS,
  SURVEY_IMPORT_WORD_MAX_TABLES,
  SURVEY_IMPORT_WORD_MAX_TABLE_CELLS,
} from "../limits";
import { documentLimitExceeded } from "./errors";
import { type TDocumentCell, type TDocumentLine, type TDocumentModel, buildDocumentModel } from "./model";
import { WordNumbering } from "./word-numbering";
import { parseDocumentXml } from "./xml";

/**
 * The Word reader of the document import (ENG-6853): our own walk over a `.docx`'s main document on
 * @xmldom/xmldom, into the keyed model (`model.ts`). It reads what Word shows once every tracked change
 * is accepted:
 *
 * - paragraphs, in the body and in table cells, each with the number or bullet its list gives it
 *   (`numbering.xml`, through the paragraph's own properties or its style's), so "Q5" and "1." are in
 *   the text for routing to name;
 * - tables, row by row, each cell keyed by its column in the table's grid; a cell's own paragraphs and
 *   nested tables are its text, one line each;
 * - tracked changes: insertions and moves kept, deletions and moved-from text dropped, and a paragraph
 *   whose mark was deleted joined to the next one;
 * - not hidden text, comments, headers, footers or notes, which the questionnaire does not show; images,
 *   drawings and embedded objects are counted, for the report to say they were not imported.
 *
 * Every part goes through the zip guard (`core/zip.ts`) when it is read, and through the XML guard
 * (`xml.ts`) before it is parsed. Paragraphs, tables and cells are counted against the Word limits as
 * the walk meets them.
 */

const W_NAMESPACES: ReadonlySet<string> = new Set([
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  // ISO 29500 Strict, which Word writes when asked to.
  "http://purl.oclc.org/ooxml/wordprocessingml/main",
]);
const MC_NAMESPACE = "http://schemas.openxmlformats.org/markup-compatibility/2006";
const DC_NAMESPACE = "http://purl.org/dc/elements/1.1/";

const DEFAULT_DOCUMENT_PART = "word/document.xml";
const DEFAULT_CORE_PART = "docProps/core.xml";

const ELEMENT_NODE = 1;

/** The element children of `node`, in order. */
function* elements(node: Node): Generator<Element> {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === ELEMENT_NODE) yield child as Element;
  }
}

const isW = (node: Element, localName: string): boolean =>
  node.localName === localName && W_NAMESPACES.has(node.namespaceURI ?? "");

const wChild = (node: Element, localName: string): Element | null => {
  for (const child of elements(node)) if (isW(child, localName)) return child;
  return null;
};

/** A `w:` attribute's value, `null` when absent. */
const wAttr = (node: Element, localName: string): string | null => {
  const namespace = node.namespaceURI;
  return namespace && node.hasAttributeNS(namespace, localName)
    ? node.getAttributeNS(namespace, localName)
    : null;
};

/** A toggle property (`<w:vanish/>`, `<w:vanish w:val="false"/>`) is on unless its value says off. */
const isOn = (property: Element | null): boolean => {
  if (!property) return false;
  const value = wAttr(property, "val");
  return value === null || !["0", "false", "off"].includes(value);
};

/** `mc:AlternateContent` holds one object several ways: only its first choice is read, so it counts once. */
const alternateChoice = (node: Element): Element | null => {
  for (const child of elements(node)) if (child.namespaceURI === MC_NAMESPACE) return child;
  return null;
};

const isAlternateContent = (node: Element): boolean =>
  node.localName === "AlternateContent" && node.namespaceURI === MC_NAMESPACE;

/* ---------------------------------------------------------------- package and parts */

const PACKAGE_RELS_NAMESPACE = "http://schemas.openxmlformats.org/package/2006/relationships";

/** A part's name from a relationship's target, relative to the part the relationships belong to. */
const resolveTarget = (sourcePart: string, target: string): string => {
  const base = target.startsWith("/") ? [] : sourcePart.split("/").slice(0, -1);
  for (const segment of target.replace(/^\//, "").split("/")) {
    if (segment === "..") base.pop();
    else if (segment !== "." && segment !== "") base.push(segment);
  }
  return base.join("/");
};

/** The relationships part of `part` (`word/_rels/document.xml.rels`), or `""` for the package's own. */
const relsPartOf = (part: string): string => {
  const slash = part.lastIndexOf("/");
  return `${part.slice(0, slash + 1)}_rels/${part.slice(slash + 1)}.rels`;
};

class WordPackage {
  constructor(private readonly archive: TZipArchive) {}

  /** A part's root element, or `null` when the archive has no part by that name. */
  parse(part: string): Element | null {
    const bytes = this.archive.read(part);
    return bytes === null ? null : parseDocumentXml(bytes, part);
  }

  /**
   * The parts `source` relates to, by relationship type (its last segment: `officeDocument`, `styles`),
   * each the first of its type. Without a relationships part, none.
   */
  relationships(source: string): Map<string, string> {
    const rels = this.parse(source === "" ? "_rels/.rels" : relsPartOf(source));
    const targets = new Map<string, string>();
    if (!rels) return targets;
    for (const rel of elements(rels)) {
      if (rel.localName !== "Relationship" || rel.namespaceURI !== PACKAGE_RELS_NAMESPACE) continue;
      const type = rel.getAttribute("Type")?.split("/").at(-1);
      const target = rel.getAttribute("Target");
      // An external target (a linked file, a URL) is never a part of this package.
      if (!type || !target || rel.getAttribute("TargetMode") === "External" || targets.has(type)) continue;
      targets.set(type, resolveTarget(source, target));
    }
    return targets;
  }
}

/** The document's Title property (`dc:title`), when it has one. */
const readTitleProperty = (core: Element | null): string | null => {
  if (!core) return null;
  for (const node of elements(core)) {
    if (node.localName === "title" && node.namespaceURI === DC_NAMESPACE) {
      const title = node.textContent?.trim() ?? "";
      return title.length > 0 ? title : null;
    }
  }
  return null;
};

/* ---------------------------------------------------------------- styles */

interface TParagraphStyle {
  name: string;
  basedOn: string | null;
  numbering: { numId: string | null; ilvl: number | null } | null;
  outlineLevel: number | null;
}

/** Inherited properties are looked up this many styles deep at most: a cycle stops here. */
const MAX_STYLE_CHAIN = 20;

const readNumberingProperty = (pPr: Element | null): TParagraphStyle["numbering"] => {
  const numPr = pPr ? wChild(pPr, "numPr") : null;
  if (!numPr) return null;
  const numId = wChild(numPr, "numId");
  const ilvl = wChild(numPr, "ilvl");
  const level = ilvl ? Number(wAttr(ilvl, "val")) : null;
  return {
    numId: numId ? wAttr(numId, "val") : null,
    ilvl: level !== null && Number.isInteger(level) ? level : null,
  };
};

const readOutlineLevel = (pPr: Element | null): number | null => {
  const outline = pPr ? wChild(pPr, "outlineLvl") : null;
  const level = outline ? Number(wAttr(outline, "val")) : Number.NaN;
  // Level 9 is body text.
  return Number.isInteger(level) && level >= 0 && level < 9 ? level : null;
};

class WordStyles {
  private readonly styles = new Map<string, TParagraphStyle>();

  constructor(root: Element | null) {
    if (!root) return;
    for (const style of elements(root)) {
      if (!isW(style, "style") || wAttr(style, "type") !== "paragraph") continue;
      const id = wAttr(style, "styleId");
      if (!id) continue;
      const name = wChild(style, "name");
      const basedOn = wChild(style, "basedOn");
      const pPr = wChild(style, "pPr");
      this.styles.set(id, {
        name: (name ? wAttr(name, "val") : null) ?? id,
        basedOn: basedOn ? wAttr(basedOn, "val") : null,
        numbering: readNumberingProperty(pPr),
        outlineLevel: readOutlineLevel(pPr),
      });
    }
  }

  /** The first value `read` finds on the style or the ones it is based on. */
  private inherited<T>(styleId: string | null, read: (style: TParagraphStyle) => T | null): T | null {
    let id = styleId;
    for (let depth = 0; id !== null && depth < MAX_STYLE_CHAIN; depth += 1) {
      const style = this.styles.get(id);
      if (!style) return null;
      const value = read(style);
      if (value !== null) return value;
      id = style.basedOn;
    }
    return null;
  }

  numbering(styleId: string | null): TParagraphStyle["numbering"] {
    return this.inherited(styleId, (style) => style.numbering);
  }

  /**
   * Whether a paragraph of this style is a title or a heading: Word's built-in Title and Heading 1–9, by
   * name or, without a styles part, by id, or any style with an outline level.
   */
  isHeading(styleId: string | null): boolean {
    if (styleId === null) return false;
    const name = (this.styles.get(styleId)?.name ?? styleId).toLowerCase().replaceAll(/\s+/g, "");
    if (name === "title" || /^heading[1-9]$/.test(name)) return true;
    return this.inherited(styleId, (style) => style.outlineLevel) !== null;
  }
}

/* ---------------------------------------------------------------- the body */

interface TParagraphBlock {
  type: "paragraph";
  text: string;
  isHeading: boolean;
}

interface TTableBlock {
  type: "table";
  /** Kept rows, each its cells with text, keyed by their first grid column (1-based). */
  rows: { column: number; text: string }[][];
}

type TBlock = TParagraphBlock | TTableBlock;

class WordWalker {
  private paragraphs = 0;
  private tables = 0;
  private cells = 0;
  images = 0;

  constructor(
    private readonly styles: WordStyles,
    private readonly numbering: WordNumbering
  ) {}

  /** The blocks of a body or a cell, in order, a paragraph whose mark was deleted joined to the next. */
  readBlocks(container: Element): TBlock[] {
    const blocks: TBlock[] = [];
    let carried = "";
    const visit = (node: Element) => {
      for (const child of elements(node)) {
        if (isW(child, "p")) {
          const paragraph = this.readParagraph(child);
          if (paragraph.markDeleted) {
            carried += paragraph.content;
            continue;
          }
          blocks.push({
            type: "paragraph",
            text: paragraph.label + carried + paragraph.content,
            isHeading: paragraph.isHeading,
          });
          carried = "";
        } else if (isW(child, "tbl")) {
          // A deleted mark before a table joins nothing: its text stays a paragraph of its own.
          if (carried.length > 0) blocks.push({ type: "paragraph", text: carried, isHeading: false });
          carried = "";
          blocks.push(this.readTable(child));
        } else if (isW(child, "sdt")) {
          const content = wChild(child, "sdtContent");
          if (content) visit(content);
        } else if (isW(child, "customXml") || isW(child, "ins") || isW(child, "moveTo")) {
          visit(child);
        } else if (isAlternateContent(child)) {
          const choice = alternateChoice(child);
          if (choice) visit(choice);
        }
      }
    };
    visit(container);
    if (carried.length > 0) blocks.push({ type: "paragraph", text: carried, isHeading: false });
    return blocks;
  }

  private readParagraph(paragraph: Element): {
    label: string;
    content: string;
    markDeleted: boolean;
    isHeading: boolean;
  } {
    this.paragraphs += 1;
    if (this.paragraphs > SURVEY_IMPORT_WORD_MAX_PARAGRAPHS) {
      throw documentLimitExceeded(
        "paragraphs",
        "file",
        `The document must not have more than ${SURVEY_IMPORT_WORD_MAX_PARAGRAPHS} paragraphs`
      );
    }

    const pPr = wChild(paragraph, "pPr");
    const styleElement = pPr ? wChild(pPr, "pStyle") : null;
    const styleId = styleElement ? wAttr(styleElement, "val") : null;
    const markProperties = pPr ? wChild(pPr, "rPr") : null;
    const markDeleted = markProperties !== null && wChild(markProperties, "del") !== null;
    const content = this.readInline(paragraph);

    // A paragraph whose mark was deleted takes the next one's properties, its number included.
    if (markDeleted) return { label: "", content, markDeleted, isHeading: false };

    const own = readNumberingProperty(pPr);
    const fromStyle = this.styles.numbering(styleId);
    const numId = own?.numId ?? fromStyle?.numId ?? null;
    const ilvl = own?.ilvl ?? fromStyle?.ilvl ?? 0;
    const label = numId === null ? "" : this.numbering.label(numId, ilvl);
    return {
      label: label.length > 0 ? `${label} ` : "",
      content,
      markDeleted,
      isHeading: this.styles.isHeading(styleId) || readOutlineLevel(pPr) !== null,
    };
  }

  /** The text of a paragraph's content, or of any inline container in it. */
  private readInline(container: Element): string {
    let text = "";
    for (const child of elements(container)) {
      if (isW(child, "r")) {
        text += this.readRun(child);
      } else if (isW(child, "del") || isW(child, "moveFrom") || isW(child, "pPr")) {
        // Deleted and moved-from text is not in the accepted document.
      } else if (isW(child, "sdt")) {
        const content = wChild(child, "sdtContent");
        if (content) text += this.readInline(content);
      } else if (isAlternateContent(child)) {
        const choice = alternateChoice(child);
        if (choice) text += this.readInline(choice);
      } else if (W_NAMESPACES.has(child.namespaceURI ?? "")) {
        // Insertions, moved-to text, links, simple fields, smart tags, custom XML, bidi runs: their runs.
        text += this.readInline(child);
      }
    }
    return text;
  }

  private readRun(run: Element): string {
    const properties = wChild(run, "rPr");
    if (properties && isOn(wChild(properties, "vanish"))) return "";

    let text = "";
    for (const child of elements(run)) {
      if (isW(child, "t")) text += child.textContent ?? "";
      else if (isW(child, "tab") || isW(child, "ptab")) text += "\t";
      else if (isW(child, "br") || isW(child, "cr")) text += "\n";
      else if (isW(child, "noBreakHyphen")) text += "-";
      else if (isW(child, "drawing") || isW(child, "pict") || isW(child, "object")) this.images += 1;
      else if (isAlternateContent(child)) {
        const choice = alternateChoice(child);
        if (choice) text += this.readRun(choice);
      }
      // Field instructions, deleted text, symbols, footnote and comment references show no text.
    }
    return text;
  }

  private readTable(table: Element): TTableBlock {
    this.tables += 1;
    if (this.tables > SURVEY_IMPORT_WORD_MAX_TABLES) {
      throw documentLimitExceeded(
        "tables",
        "file",
        `The document must not have more than ${SURVEY_IMPORT_WORD_MAX_TABLES} tables`
      );
    }

    const rows: TTableBlock["rows"] = [];
    for (const row of this.tableRows(table)) {
      const rowProperties = wChild(row, "trPr");
      // A row deleted as a tracked change is not in the accepted table.
      if (rowProperties && wChild(rowProperties, "del")) continue;
      const cells: TTableBlock["rows"][number] = [];
      let column = 1;
      for (const cell of this.rowCells(row)) {
        this.cells += 1;
        if (this.cells > SURVEY_IMPORT_WORD_MAX_TABLE_CELLS) {
          throw documentLimitExceeded(
            "table_cells",
            "file",
            `The document's tables must not have more than ${SURVEY_IMPORT_WORD_MAX_TABLE_CELLS} cells`
          );
        }
        const cellProperties = wChild(cell, "tcPr");
        const span = cellProperties ? wChild(cellProperties, "gridSpan") : null;
        const spanValue = span ? Number(wAttr(span, "val")) : 1;
        const text = this.cellText(cell);
        if (text.trim() !== "") cells.push({ column, text });
        column += Number.isInteger(spanValue) && spanValue > 1 ? spanValue : 1;
      }
      rows.push(cells);
    }
    return { type: "table", rows };
  }

  /** A table's rows, inside content controls and custom XML too. */
  private *tableRows(table: Element): Generator<Element> {
    for (const child of elements(table)) {
      if (isW(child, "tr")) yield child;
      else if (isW(child, "sdt")) {
        const content = wChild(child, "sdtContent");
        if (content) yield* this.tableRows(content);
      } else if (isW(child, "customXml")) yield* this.tableRows(child);
    }
  }

  /** A row's cells, inside content controls and custom XML too. */
  private *rowCells(row: Element): Generator<Element> {
    for (const child of elements(row)) {
      if (isW(child, "tc")) yield child;
      else if (isW(child, "sdt")) {
        const content = wChild(child, "sdtContent");
        if (content) yield* this.rowCells(content);
      } else if (isW(child, "customXml")) yield* this.rowCells(child);
    }
  }

  /** A cell's paragraphs and nested tables, a line each. */
  private cellText(cell: Element): string {
    return this.readBlocks(cell)
      .flatMap((block) =>
        block.type === "paragraph"
          ? [block.text]
          : block.rows.flatMap((row) => row.map((entry) => entry.text))
      )
      .filter((text) => text.trim() !== "")
      .join("\n");
  }
}

/** The body's blocks as the model's lines: a paragraph `P<n>`, a table row `T<t>R<r>`. */
const toLines = (blocks: readonly TBlock[]): TDocumentLine[] => {
  const lines: TDocumentLine[] = [];
  let paragraph = 0;
  let table = 0;
  for (const block of blocks) {
    if (block.type === "paragraph") {
      paragraph += 1;
      if (block.text.trim() === "") continue;
      const key = `P${paragraph}`;
      lines.push({ key, cells: [{ key, text: block.text }] });
      continue;
    }
    table += 1;
    block.rows.forEach((row, rowIndex) => {
      if (row.length === 0) return;
      const key = `T${table}R${rowIndex + 1}`;
      const cells: TDocumentCell[] = row.map(({ column, text }) => ({ key: `${key}C${column}`, text }));
      lines.push({ key, cells, table: `T${table}` });
    });
  }
  return lines;
};

/** The first heading in the body, as the document's name when it has no title property. */
const firstHeading = (blocks: readonly TBlock[]): string | null => {
  for (const block of blocks) {
    if (block.type === "paragraph" && block.isHeading) {
      const text = block.text.trim();
      if (text.length > 0) return text;
    }
  }
  return null;
};

/**
 * Read a `.docx` (the archive the sniffer opened) into the document model. Throws
 * `SurveyImportFileTooLargeError` (413) past the zip limits, and `SurveyImportInputError` (422) past the
 * XML or Word limits (`document_limit_exceeded`) or for a document that cannot be read or has no text
 * (`file_unreadable`).
 */
export const readWordDocument = (archive: TZipArchive): TDocumentModel => {
  const wordPackage = new WordPackage(archive);
  const packageParts = wordPackage.relationships("");
  const documentPart = packageParts.get("officeDocument") ?? DEFAULT_DOCUMENT_PART;
  const document = wordPackage.parse(documentPart);
  const body = document && isW(document, "document") ? wChild(document, "body") : null;
  if (!body) {
    throw surveyImportFileUnreadable("The file has no Word document");
  }

  const documentParts = wordPackage.relationships(documentPart);
  const stylesPart = documentParts.get("styles");
  const numberingPart = documentParts.get("numbering");
  const walker = new WordWalker(
    new WordStyles(stylesPart ? wordPackage.parse(stylesPart) : null),
    new WordNumbering(numberingPart ? wordPackage.parse(numberingPart) : null)
  );
  const blocks = walker.readBlocks(body);
  const lines = toLines(blocks);
  if (lines.length === 0) throw surveyImportFileUnreadable("The document has no text");

  const corePart = packageParts.get("core-properties") ?? DEFAULT_CORE_PART;
  const title = readTitleProperty(wordPackage.parse(corePart)) ?? firstHeading(blocks);
  return buildDocumentModel("docx", lines, { title, images: walker.images });
};
