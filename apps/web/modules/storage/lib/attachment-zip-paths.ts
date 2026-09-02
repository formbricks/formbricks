/**
 * Naming for the response-attachment ZIP export (ENG-1256).
 *
 * Respondents upload whatever their phone or laptop called the file, so a flat archive is a pile of
 * `photo.jpg`, `photo (1).jpg` and `IMG_0042.jpg` with nothing tying a file back to the answer it came
 * from. Every path this module builds is therefore
 * `{YYYY-MM-DDTHH-MM-SS}_{responseId}/{n}_{elementLabel}/{originalFileName}`: the response folder joins the
 * archive to the CSV/Excel export by response id, and the numeric prefix on the element folder keeps
 * questions in survey order rather than alphabetical order.
 *
 * Pure on purpose — no `server-only`, no I/O — because this is where the naming decision is unit-tested.
 */

// Long headlines are common, and the extraction directory the user picks is prepended to every path
// inside the archive. 60 keeps a response/element/file path readable and comfortably short.
const MAX_SEGMENT_LENGTH = 60;
const MAX_EXTENSION_LENGTH = 20;

const FALLBACK_SEGMENT = "unnamed";
const FALLBACK_FILE_NAME = "file";

// Reserved DOS device names. A segment that is exactly one of these (with or without an extension) is
// unusable on Windows, so it gets an underscore prefix.
const RESERVED_WINDOWS_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

const stripUnsafeCharacters = (raw: string): string =>
  raw
    .normalize("NFC")
    // Path separators become a dash rather than being dropped, so "Front/Back" stays two words.
    .replace(/[\\/]/g, "-")
    // Control characters, plus the characters Windows and macOS reject in a name. Written as
    // explicit escapes so the class stays readable — raw control bytes in the source render as an
    // innocuous-looking `[ -:...]` span in most editors and diffs.
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point here
    .replace(/[\u0000-\u001f\u007f:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// A segment may not begin or end with a dot or a space: Windows silently trims them on extraction,
// which turns two distinct names into one collision after the archive has already been written.
//
// Scanned rather than matched with `/^[.\s]+|[.\s]+$/`: an anchored quantified class backtracks
// super-linearly on a long run of dots and spaces, and these strings come from user content.
const isTrimmableEdge = (char: string): boolean => char === "." || /\s/.test(char);

const trimEdges = (value: string): string => {
  let start = 0;
  let end = value.length;

  while (start < end && isTrimmableEdge(value[start])) start++;
  while (end > start && isTrimmableEdge(value[end - 1])) end--;

  return value.slice(start, end);
};

const escapeReservedName = (value: string): string =>
  RESERVED_WINDOWS_NAMES.has(value.toLowerCase()) ? `_${value}` : value;

/**
 * Sanitizes one folder segment — a question headline, typically. Headlines come from user content and
 * routinely carry slashes, emoji, punctuation and non-Latin script across multi-language surveys.
 *
 * Not `sanitizeFileName` from `../utils`: that one is written for an upload's file name and keeps only
 * the last dot-extension, so a headline like `Q3. Upload a photo` would lose everything after the dot.
 */
export const sanitizeZipPathSegment = (raw: string): string => {
  const stripped = trimEdges(stripUnsafeCharacters(raw ?? ""));
  if (!stripped) return FALLBACK_SEGMENT;

  const truncated = trimEdges(stripped.slice(0, MAX_SEGMENT_LENGTH));
  if (!truncated) return FALLBACK_SEGMENT;

  return escapeReservedName(truncated);
};

const splitExtension = (fileName: string): { base: string; extension: string } => {
  const dotIndex = fileName.lastIndexOf(".");
  // A leading dot is part of the name (`.env`), not an extension.
  if (dotIndex <= 0) return { base: fileName, extension: "" };
  return { base: fileName.slice(0, dotIndex), extension: fileName.slice(dotIndex + 1) };
};

/**
 * Sanitizes the leaf file name, preserving its extension. Truncation applies to the base only — cutting
 * the extension off would leave the file unopenable.
 */
export const sanitizeZipFileName = (raw: string): string => {
  const { base, extension } = splitExtension((raw ?? "").normalize("NFC"));

  const safeBase = trimEdges(trimEdges(stripUnsafeCharacters(base)).slice(0, MAX_SEGMENT_LENGTH));
  const safeExtension = extension.replace(/[^A-Za-z0-9]/g, "").slice(0, MAX_EXTENSION_LENGTH);

  if (!safeBase) {
    return safeExtension ? `${FALLBACK_FILE_NAME}.${safeExtension}` : FALLBACK_FILE_NAME;
  }

  const escapedBase = escapeReservedName(safeBase);
  return safeExtension ? `${escapedBase}.${safeExtension}` : escapedBase;
};

/**
 * `YYYY-MM-DDTHH-MM-SS` in the organization's display time zone.
 *
 * The zone is the same one the CSV and Excel exports stamp their Timestamp column with
 * (`organization.displayTimeZone`, "the IANA time zone used for human-facing response timestamps"), so
 * a folder and its row in the response export read the same clock. The absolute instant stays available
 * in UTC in `manifest.csv`, which is machine-facing.
 *
 * The time is part of the name, not just the date: a survey taking a thousand responses a day would
 * otherwise put them all under one date prefix, where the rest of the folder name is a cuid2 and sorts
 * randomly. With seconds included, the lexicographic order a file browser shows *is* chronological
 * order. Colons become dashes because Windows rejects them in a path and macOS renders them as `/`.
 */
const formatResponseFolderTimestamp = (date: Date, timeZone: string): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone,
  };

  // Assembled from named parts rather than from `format()`. The separators `format()` places between
  // the fields are an implementation-defined locale pattern: ICU has already changed them once (the
  // narrow no-break space before a time), and a pattern emitting `/` would smuggle a directory
  // separator into the ZIP path. Only the numeric parts are read here, so no locale literal can reach
  // the folder name.
  const partsIn = (zone: string): Intl.DateTimeFormatPart[] =>
    new Intl.DateTimeFormat("en-CA", { ...options, timeZone: zone }).formatToParts(date);

  let parts: Intl.DateTimeFormatPart[];
  try {
    // An invalid IANA zone makes Intl.DateTimeFormat throw a RangeError. Degrade to UTC rather than
    // failing the whole export, matching getFormattedDateTimeString.
    parts = partsIn(timeZone);
  } catch {
    parts = partsIn("UTC");
  }

  const valueOf = (type: Intl.DateTimeFormatPartTypes): string | undefined =>
    parts.find((part) => part.type === type)?.value;

  const fields = (["year", "month", "day", "hour", "minute", "second"] as const).map(valueOf);

  // Every field has to be a run of digits. Anything else means the runtime produced a shape this does
  // not understand, and a half-built folder name is worse than a plain UTC one.
  if (fields.some((field) => field === undefined || !/^\d+$/.test(field))) {
    return date.toISOString().slice(0, 19).replaceAll(":", "-");
  }

  const [year, month, day, hour, minute, second] = fields;
  return `${year}-${month}-${day}T${hour}-${minute}-${second}`;
};

const withCollisionSuffix = (fileName: string, attempt: number): string => {
  const { base, extension } = splitExtension(fileName);
  const suffixed = `${base} (${attempt})`;
  return extension ? `${suffixed}.${extension}` : suffixed;
};

export interface BuildAttachmentZipPathParams {
  responseId: string;
  responseCreatedAt: Date;
  /** 1-based position of the element in the survey, so folders sort in survey order. */
  elementIndex: number;
  elementLabel: string;
  originalFileName: string;
  /** IANA zone the response folder's clock is rendered in; `organization.displayTimeZone`. */
  timeZone: string;
  /**
   * Paths already claimed in this archive. The chosen path is added to it, so the caller cannot forget
   * to register it and silently emit a duplicate entry.
   */
  usedPaths: Set<string>;
}

/**
 * Builds the in-ZIP path for one attachment, de-duplicating against `usedPaths`.
 *
 * One respondent uploading two files to the same question is the normal case, not an edge case, and
 * both regularly arrive as `photo.jpg`. The suffix goes before the extension (`photo (2).jpg`) so the
 * file still opens.
 */
export const buildAttachmentZipPath = ({
  responseId,
  responseCreatedAt,
  elementIndex,
  elementLabel,
  originalFileName,
  timeZone,
  usedPaths,
}: BuildAttachmentZipPathParams): string => {
  const responseFolder = `${formatResponseFolderTimestamp(responseCreatedAt, timeZone)}_${responseId}`;
  const elementFolder = `${elementIndex}_${sanitizeZipPathSegment(elementLabel)}`;
  const fileName = sanitizeZipFileName(originalFileName);

  const directory = `${responseFolder}/${elementFolder}`;

  let candidate = `${directory}/${fileName}`;
  let attempt = 2;
  while (usedPaths.has(candidate)) {
    candidate = `${directory}/${withCollisionSuffix(fileName, attempt)}`;
    attempt++;
  }

  usedPaths.add(candidate);
  return candidate;
};
