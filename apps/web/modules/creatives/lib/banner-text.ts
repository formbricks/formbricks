import type { TCreativeTextRun } from "./editor-form";

/**
 * Banner text between its stored form and the editor. A banner message is stored and delivered as text
 * runs, never HTML (the v3 `CreativeTextRun`); the editor reuses the shared rich-text editor, which reads
 * and writes HTML. These two functions are the only crossing: runs become minimal markup the editor
 * imports, and whatever markup the editor exports is read back into runs, keeping only bold, italic,
 * underline and links the banner may carry. Paragraphs and line breaks become `\n`.
 */

type TRunFormat = Omit<TCreativeTextRun, "text">;

/** The v3 rule for a run's `href`: http(s), mailto:, tel: or a root-relative path. */
const HREF_PATTERN = /^(?:https?:\/\/|mailto:|tel:|\/(?!\/))\S*$/;
const MAX_HREF_LENGTH = 2048;

const BLOCK_TAGS = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "PRE"]);
const BOLD_TAGS = new Set(["B", "STRONG"]);
const ITALIC_TAGS = new Set(["I", "EM"]);

/** The shared editor's theme classes (`example-theme.ts`), for text it exports without a format tag. */
const BOLD_CLASS = "fb-editor-text-bold";
const ITALIC_CLASS = "fb-editor-text-italic";
const UNDERLINE_CLASS = "fb-editor-text-underline";

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const toRunHtml = (run: TCreativeTextRun, text: string): string => {
  let html = escapeHtml(text);
  if (run.underline) html = `<u>${html}</u>`;
  if (run.italic) html = `<em>${html}</em>`;
  if (run.bold) html = `<strong>${html}</strong>`;
  if (run.href) html = `<a href="${escapeHtml(run.href)}">${html}</a>`;
  return html;
};

/** The runs as markup the editor imports: one paragraph per line. */
export const bannerRunsToHtml = (runs: TCreativeTextRun[]): string => {
  const paragraphs: string[][] = [[]];
  for (const run of runs) {
    run.text.split("\n").forEach((part, index) => {
      if (index > 0) paragraphs.push([]);
      if (part) paragraphs[paragraphs.length - 1].push(toRunHtml(run, part));
    });
  }
  return paragraphs.map((parts) => `<p>${parts.join("")}</p>`).join("");
};

const isAllowedHref = (href: string): boolean => href.length <= MAX_HREF_LENGTH && HREF_PATTERN.test(href);

const getElementFormat = (element: Element, inherited: TRunFormat): TRunFormat => {
  const { tagName, classList } = element;
  const format: TRunFormat = { ...inherited };
  if (BOLD_TAGS.has(tagName) || classList.contains(BOLD_CLASS)) format.bold = true;
  if (ITALIC_TAGS.has(tagName) || classList.contains(ITALIC_CLASS)) format.italic = true;
  if (tagName === "U" || classList.contains(UNDERLINE_CLASS)) format.underline = true;
  if (tagName === "A") {
    const href = element.getAttribute("href")?.trim();
    if (href && isAllowedHref(href)) format.href = href;
  }
  return format;
};

const endsWithLineBreak = (runs: TCreativeTextRun[]): boolean => runs.at(-1)?.text.endsWith("\n") ?? true;

const collectRuns = (node: Node, format: TRunFormat, runs: TCreativeTextRun[]): void => {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.textContent) runs.push({ text: node.textContent, ...format });
    return;
  }
  if (!(node instanceof Element)) return;
  if (node.tagName === "BR") {
    runs.push({ text: "\n" });
    return;
  }
  if (BLOCK_TAGS.has(node.tagName) && !endsWithLineBreak(runs)) runs.push({ text: "\n" });
  const childFormat = getElementFormat(node, format);
  node.childNodes.forEach((child) => collectRuns(child, childFormat, runs));
};

const sameFormat = (left: TCreativeTextRun, right: TCreativeTextRun): boolean =>
  !!left.bold === !!right.bold &&
  !!left.italic === !!right.italic &&
  !!left.underline === !!right.underline &&
  left.href === right.href;

const mergeRuns = (runs: TCreativeTextRun[]): TCreativeTextRun[] =>
  runs.reduce<TCreativeTextRun[]>((merged, run) => {
    const previous = merged.at(-1);
    if (previous && sameFormat(previous, run)) {
      merged[merged.length - 1] = { ...previous, text: previous.text + run.text };
    } else {
      merged.push(run);
    }
    return merged;
  }, []);

/** Line breaks at either end carry nothing a visitor sees; a run must keep at least one character. */
const trimLineBreaks = (runs: TCreativeTextRun[]): TCreativeTextRun[] => {
  const trimmed = runs.map((run, index) => {
    let { text } = run;
    if (index === 0) text = text.replace(/^\n+/, "");
    if (index === runs.length - 1) text = text.replace(/\n+$/, "");
    return { ...run, text };
  });
  const kept = trimmed.filter((run) => run.text.length > 0);
  return kept.length === trimmed.length ? kept : trimLineBreaks(kept);
};

/** The editor's markup as runs. Browser-only: it parses with `DOMParser`. */
export const bannerHtmlToRuns = (html: string): TCreativeTextRun[] => {
  const document = new DOMParser().parseFromString(html, "text/html");
  const runs: TCreativeTextRun[] = [];
  document.body.childNodes.forEach((child) => collectRuns(child, {}, runs));
  return trimLineBreaks(mergeRuns(runs));
};

export const getBannerPlainText = (runs: TCreativeTextRun[]): string => runs.map((run) => run.text).join("");
