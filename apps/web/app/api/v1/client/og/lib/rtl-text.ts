/**
 * Scripts written right-to-left. Matched on letters only (`Script=`, not `Script_Extensions=`), so a
 * shared character like a comma or a digit never classifies an otherwise Latin name as RTL.
 */
const RTL_SCRIPTS =
  /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}\p{Script=Adlam}]/u;

/**
 * Satori, the engine behind `next/og`, does not implement bidirectional layout: it shapes the glyphs
 * but never reorders the words, so right-to-left text comes out in logical order and reads wrong.
 * Vercel documents this as unsupported, and `direction: rtl` is a no-op — the output is identical.
 *
 * Arabic additionally crashes outright. Shaping it pulls Noto Sans Arabic from Google Fonts, whose
 * required-ligature feature uses a GSUB lookup the bundled font parser does not implement, and the
 * throw escapes mid-stream. It also poisons a per-process font store, so the first such request to a
 * fresh pod breaks every later Arabic render in that process (ENG-2500).
 *
 * We therefore leave the title off the card for these scripts rather than render it wrongly. Revisit
 * if satori ever ships bidi support.
 */
export const isRtlText = (value: string | null): boolean => (value ? RTL_SCRIPTS.test(value) : false);
