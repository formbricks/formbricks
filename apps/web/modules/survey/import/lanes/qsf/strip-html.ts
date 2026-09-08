const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  euro: "€",
  copy: "©",
  reg: "®",
  trade: "™",
};

const BLOCK_TAGS = /<\/?(?:p|div|br|li|ul|ol|h[1-6]|tr|td|th|table|blockquote|section|article|hr)\b[^>]*>/gi;

export function decodeHtmlEntities(text: string): string {
  return text.replaceAll(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/**
 * Qualtrics stores every text as HTML. Formbricks headlines are plain text, so: drop `<script>` and
 * `<style>` with their content, turn block-level tags and `<br>` into spaces, strip the remaining tags,
 * decode entities, collapse whitespace.
 */
export function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replaceAll(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replaceAll(BLOCK_TAGS, " ")
      .replaceAll(/<[^>]+>/g, "")
  )
    .replaceAll(/\s+/g, " ")
    .trim();
}

/** Split a long text into a headline (first sentence) and the rest. */
export function splitHeadline(
  text: string,
  maxHeadlineLength: number
): { headline: string; rest: string | null } {
  if (text.length <= maxHeadlineLength) return { headline: text, rest: null };

  const sentenceEnd = /[.!?](\s|$)/g;
  let match: RegExpExecArray | null;
  while ((match = sentenceEnd.exec(text)) !== null) {
    const end = match.index + 1;
    if (end >= 20 && end <= maxHeadlineLength) {
      return { headline: text.slice(0, end).trim(), rest: text.slice(end).trim() || null };
    }
    if (end > maxHeadlineLength) break;
  }

  const cut = text.lastIndexOf(" ", maxHeadlineLength);
  const at = cut > 20 ? cut : maxHeadlineLength;
  return { headline: text.slice(0, at).trim(), rest: text.slice(at).trim() || null };
}
