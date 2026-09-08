import { PAGE_BREAK } from "./types";

/**
 * Converts the clean, predictable HTML mammoth emits for a DOCX into the Markdown-ish text the
 * document lane feeds the model. It is not a general HTML converter: it knows headings, paragraphs,
 * lists (nested, ordered), tables, line and page breaks, and drops everything else to its text.
 */

type TToken = { kind: "open" | "close" | "text"; name: string; text: string };

const VOID_TAGS = new Set(["br", "hr", "img"]);

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

function tokenize(html: string): TToken[] {
  const tokens: TToken[] = [];
  const pattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>|[^<]+/g;
  for (const match of html.matchAll(pattern)) {
    const [raw, tagName] = match;
    if (tagName) {
      const name = tagName.toLowerCase();
      const isClose = raw.startsWith("</");
      // Void tags (<br>, <hr>) never get a close token; the builder treats their open as the event.
      tokens.push({ kind: isClose && !VOID_TAGS.has(name) ? "close" : "open", name, text: "" });
    } else {
      tokens.push({ kind: "text", name: "", text: decodeEntities(raw) });
    }
  }
  return tokens;
}

type TListFrame = { ordered: boolean; index: number };

class MarkdownBuilder {
  private readonly blocks: string[] = [];
  /** Block prefix (heading marks, list marker with indent) kept apart from the text so trimming spares it. */
  private prefix = "";
  private current = "";
  private readonly lists: TListFrame[] = [];
  private table: string[][] | null = null;
  private row: string[] | null = null;
  private cell = "";

  text(value: string): void {
    if (this.row) {
      this.cell += value;
      return;
    }
    this.current += value;
  }

  lineBreak(): void {
    if (this.row) {
      this.cell += " ";
      return;
    }
    this.current += "\n";
  }

  private flushCurrent(): void {
    const content = this.current.replace(/\s+\n/g, "\n").trim();
    const prefix = this.prefix;
    this.current = "";
    this.prefix = "";
    if (content.length > 0) {
      this.blocks.push(prefix + content);
    }
  }

  heading(level: number): void {
    this.flushCurrent();
    this.prefix = `${"#".repeat(Math.min(level, 6))} `;
  }

  endBlock(): void {
    if (this.row) return;
    this.flushCurrent();
  }

  openList(ordered: boolean): void {
    this.flushCurrent();
    this.lists.push({ ordered, index: 0 });
  }

  closeList(): void {
    this.flushCurrent();
    this.lists.pop();
  }

  openItem(): void {
    this.flushCurrent();
    const frame = this.lists[this.lists.length - 1];
    if (!frame) return;
    frame.index += 1;
    const indent = "  ".repeat(Math.max(0, this.lists.length - 1));
    this.prefix = `${indent}${frame.ordered ? `${frame.index}.` : "-"} `;
  }

  closeItem(): void {
    this.flushCurrent();
  }

  openTable(): void {
    this.flushCurrent();
    this.table = [];
  }

  openRow(): void {
    this.row = [];
  }

  openCell(): void {
    this.cell = "";
  }

  closeCell(): void {
    this.row?.push(this.cell.replace(/\s+/g, " ").trim());
    this.cell = "";
  }

  closeRow(): void {
    if (this.row && this.table) {
      this.table.push(this.row);
    }
    this.row = null;
  }

  closeTable(rowsToTable: (rows: string[][]) => string): void {
    if (this.table) {
      const rendered = rowsToTable(this.table);
      if (rendered.length > 0) {
        this.blocks.push(rendered);
      }
    }
    this.table = null;
  }

  pageBreak(): void {
    this.flushCurrent();
    this.blocks.push(PAGE_BREAK.trim());
  }

  build(): string {
    this.flushCurrent();
    // List items are single blocks; keep consecutive items on adjacent lines.
    const joined: string[] = [];
    let previousWasItem = false;
    for (const block of this.blocks) {
      const isItem = /^\s*(?:[-*]|\d+\.)\s/.test(block);
      joined.push(isItem && previousWasItem ? `\n${block}` : `\n\n${block}`);
      previousWasItem = isItem;
    }
    return joined.join("").trim();
  }
}

export function htmlToMarkdown(html: string, rowsToTable: (rows: string[][]) => string): string {
  const builder = new MarkdownBuilder();

  for (const token of tokenize(html)) {
    if (token.kind === "text") {
      builder.text(token.text);
      continue;
    }

    const heading = /^h([1-6])$/.exec(token.name);
    if (token.kind === "open") {
      if (heading) builder.heading(Number(heading[1]));
      else if (token.name === "p") builder.endBlock();
      else if (token.name === "br") builder.lineBreak();
      else if (token.name === "hr") builder.pageBreak();
      else if (token.name === "ul") builder.openList(false);
      else if (token.name === "ol") builder.openList(true);
      else if (token.name === "li") builder.openItem();
      else if (token.name === "table") builder.openTable();
      else if (token.name === "tr") builder.openRow();
      else if (token.name === "td" || token.name === "th") builder.openCell();
    } else if (heading || token.name === "p") builder.endBlock();
    else if (token.name === "ul" || token.name === "ol") builder.closeList();
    else if (token.name === "li") builder.closeItem();
    else if (token.name === "td" || token.name === "th") builder.closeCell();
    else if (token.name === "tr") builder.closeRow();
    else if (token.name === "table") builder.closeTable(rowsToTable);
  }

  return builder.build();
}
