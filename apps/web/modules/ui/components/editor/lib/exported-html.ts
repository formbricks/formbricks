/**
 * The editor's exported markup (`$generateHtmlFromNodes`) as `setText` hands it on. Lexical escapes `<`
 * and `>` in text; by default they are decoded again, the form every existing consumer stores. A
 * consumer that parses the markup as HTML once more keeps them escaped (`keepEscapedText`), or a literal
 * `<b>` someone typed would come back as a tag.
 */
export const toEditorOutputHtml = (html: string, { keepEscapedText = false } = {}): string => {
  const text = keepEscapedText ? html : html.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return text.replace(/white-space:\s*pre-wrap;?/g, "");
};
