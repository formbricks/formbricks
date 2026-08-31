import { TResponseDataValue } from "@formbricks/types/responses";

export const isValidValue = (value: TResponseDataValue) => {
  return (
    (typeof value === "string" && value.trim() !== "") ||
    (Array.isArray(value) && value.length > 0) ||
    typeof value === "number" ||
    (typeof value === "object" && Object.entries(value).length > 0)
  );
};

export const isSubmissionTimeMoreThan5Minutes = (submissionTimeISOString: Date) => {
  const submissionTime: Date = new Date(submissionTimeISOString);
  const currentTime: Date = new Date();
  const timeDifference: number = (currentTime.getTime() - submissionTime.getTime()) / (1000 * 60); // Convert milliseconds to minutes
  return timeDifference > 5;
};

const RECALL_HIGHLIGHT_OPEN = "#/";
const RECALL_HIGHLIGHT_CLOSE = String.raw`\#`;

/** The characters `.` excludes, so a highlighted span can never cross one. */
const isLineTerminator = (character: string): boolean =>
  character === "\n" || character === "\r" || character === "\u2028" || character === "\u2029";

/**
 * Split recall-highlighted text into alternating plain and highlighted parts, exactly as
 * `text.split(/#\/(.*?)\\#/g)` did: even indices are plain text, odd indices are the highlighted
 * spans.
 *
 * A scan rather than the regex. `(.*?)` is unbounded, so on a run of `#/` with no `\#` after it the
 * engine expands to the end of the text from every one — O(N^2), measured 4.9s on 200k characters,
 * over text that carries respondent-submitted answers into the admin's browser. Capping the span is
 * not a fix: when the over-long span contains another `#/`, the match restarts there and highlights
 * a different range.
 *
 * Linear because a failed span skips to the next line rather than to the next character: `.` cannot
 * cross a line terminator, so if no `\#` precedes the next one, no later `#/` on that line has one
 * either.
 */
export const splitRecallHighlights = (text: string): string[] => {
  const parts: string[] = [];
  let copiedTo = 0;
  let searchFrom = 0;

  while (searchFrom <= text.length) {
    const open = text.indexOf(RECALL_HIGHLIGHT_OPEN, searchFrom);
    if (open === -1) break;

    const contentStart = open + RECALL_HIGHLIGHT_OPEN.length;
    let close = -1;
    let scan = contentStart;
    while (scan < text.length && !isLineTerminator(text[scan])) {
      if (text.startsWith(RECALL_HIGHLIGHT_CLOSE, scan)) {
        close = scan;
        break;
      }
      scan++;
    }

    if (close === -1) {
      // No close before the line ends, so nothing on the rest of this line can close either.
      searchFrom = scan < text.length ? scan + 1 : text.length + 1;
      continue;
    }

    parts.push(text.slice(copiedTo, open), text.slice(contentStart, close));
    copiedTo = close + RECALL_HIGHLIGHT_CLOSE.length;
    searchFrom = copiedTo;
  }

  parts.push(text.slice(copiedTo));
  return parts;
};
