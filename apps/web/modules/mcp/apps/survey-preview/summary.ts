/**
 * The text a model reads for `show_survey`. A host without MCP Apps support shows nothing else, so it has
 * to stand on its own: what was shown, and enough of the outline to talk about the survey. Built from the
 * v3 survey resource that `structuredContent` carries, read defensively: this is a summary, and a shape it
 * does not recognise must cost a line of it, never the whole result.
 */

const MAX_OUTLINE_LINES = 40;
const MAX_HEADLINE_CHARACTERS = 120;

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/** One translatable string in the survey's default language, flattened to a single short line. */
const readText = (value: unknown, defaultLanguage: string | undefined): string => {
  if (!isRecord(value)) return "";
  const text =
    (defaultLanguage ? asString(value[defaultLanguage]) : undefined) ??
    asString(value.default) ??
    Object.values(value).find((entry): entry is string => typeof entry === "string") ??
    "";
  const oneLine = text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return oneLine.length > MAX_HEADLINE_CHARACTERS
    ? `${oneLine.slice(0, MAX_HEADLINE_CHARACTERS - 1)}…`
    : oneLine;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "draft",
  inProgress: "in progress",
  paused: "paused",
  completed: "completed",
};

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

export const buildShowSurveySummary = (data: unknown): string => {
  if (!isRecord(data)) {
    return "Showing the survey to the user in an interactive preview.";
  }

  const defaultLanguage = asString(data.defaultLanguage);
  const blocks = asArray(data.blocks).filter(isRecord);
  const elementCount = blocks.reduce((sum, block) => sum + asArray(block.elements).length, 0);
  const languages = asArray(data.languages)
    .filter(isRecord)
    .map((language) => {
      const code = asString(language.code) ?? "?";
      return language.default === true ? `${code} (default)` : code;
    });
  const status = asString(data.status);

  const facts = [
    `${asString(data.type) ?? "unknown type"} survey`,
    STATUS_LABEL[status ?? ""] ?? status ?? "unknown status",
    plural(blocks.length, "block"),
    plural(elementCount, "question"),
    languages.length > 0 ? `languages: ${languages.join(", ")}` : undefined,
  ].filter(Boolean);

  const lines = [
    `Showing the survey "${asString(data.name) ?? "Untitled"}" (${facts.join("; ")}) to the user in an interactive preview.`,
    "They can review the outline and try the survey themselves; nothing they enter in the preview is stored.",
    "Do not repeat the outline in your reply: say what you notice or ask what they would like to change.",
  ];

  const outline: string[] = [];
  let questionNumber = 0;
  blocks.forEach((block, blockIndex) => {
    const name = asString(block.name);
    outline.push(`Block ${blockIndex + 1}${name ? `: ${name}` : ""}`);
    asArray(block.elements)
      .filter(isRecord)
      .forEach((element) => {
        questionNumber += 1;
        const flags = [asString(element.type), element.required === true ? "required" : "optional"];
        outline.push(
          `  ${questionNumber}. [${flags.filter(Boolean).join(", ")}] ${readText(element.headline, defaultLanguage)}`
        );
      });
  });

  const endings = asArray(data.endings).filter(isRecord);
  endings.forEach((ending, index) => {
    const label =
      asString(ending.type) === "redirectToUrl"
        ? `redirect to ${asString(ending.url) ?? "a URL"}`
        : readText(ending.headline, defaultLanguage);
    outline.push(`Ending ${index + 1}: ${label}`);
  });

  if (outline.length > 0) {
    const shown = outline.slice(0, MAX_OUTLINE_LINES);
    lines.push("", `Outline${defaultLanguage ? ` (${defaultLanguage})` : ""}:`, ...shown);
    if (outline.length > shown.length) {
      lines.push(`… ${outline.length - shown.length} more lines; the full survey is in structuredContent.`);
    }
  }

  return lines.join("\n");
};
