/**
 * File names and `Content-Disposition` headers for downloads (RFC 6266, RFC 8187).
 *
 * A download keeps the name its user gave the thing it holds — a survey called "Größe" downloads as
 * `Größe.formbricks.json`, an Arabic one under its Arabic name — so the name has to be made safe for
 * every file system it may land on, and the header has to carry it in UTF-8 with an ASCII fallback
 * for the clients that read only `filename`. Parsing lives next door in `file-download.ts`.
 */
import { toDisplayFileName } from "@/lib/utils/display-file-name";

/** The most bytes a file name may take on the common file systems (ext4, APFS, NTFS's 255 UTF-16 units). */
export const DOWNLOAD_FILE_NAME_MAX_BYTES = 255;

// Path separators and the characters Windows refuses anywhere in a name.
const FORBIDDEN_CHARACTERS = /[/\\:*?"<>|]/g;
// CON, PRN, AUX, NUL, COM1–9 and LPT1–9 name devices on Windows, with or without an extension.
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

const encoder = new TextEncoder();

const isDotOrSpace = (character: string): boolean => character === "." || /\s/.test(character);

/**
 * `value` without its leading and trailing dots and whitespace. A loop rather than `/[.\s]+$/`, which
 * backtracks from every dot and space of a run that stops short of the end: 22 s on a 200 KB name.
 */
const trimDotsAndSpaces = (value: string): string => {
  let start = 0;
  let end = value.length;
  while (start < end && isDotOrSpace(value[start])) start += 1;
  while (end > start && isDotOrSpace(value[end - 1])) end -= 1;
  return value.slice(start, end);
};

// The display name, then without the characters a file system refuses.
const cleanName = (name: string): string =>
  trimDotsAndSpaces(toDisplayFileName(name).replaceAll(FORBIDDEN_CHARACTERS, "").replaceAll(/\s+/g, " "));

/** The longest prefix of `value` that fits in `maxBytes` of UTF-8, cut between code points. */
const truncateToBytes = (value: string, maxBytes: number): string => {
  let bytes = 0;
  let end = 0;
  for (const codePoint of value) {
    const size = encoder.encode(codePoint).length;
    if (bytes + size > maxBytes) break;
    bytes += size;
    end += codePoint.length;
  }
  return value.slice(0, end);
};

/**
 * A safe file name for a download: `name` with separators, control characters and Windows-illegal
 * characters removed, leading and trailing dots and spaces trimmed, a Windows device name escaped,
 * then `extension` appended and the whole capped at {@link DOWNLOAD_FILE_NAME_MAX_BYTES}. When
 * nothing readable is left of `name`, `fallbackName` stands in for it.
 *
 * @param extension Appended as given (with its dot), e.g. `.formbricks.json`; it is trusted.
 */
export const buildDownloadFileName = (name: string, extension: string, fallbackName: string): string => {
  const maxBaseBytes = DOWNLOAD_FILE_NAME_MAX_BYTES - encoder.encode(extension).length;

  let base = cleanName(name) || fallbackName;
  if (WINDOWS_RESERVED_NAME.test(base.split(".")[0].trim())) base = `_${base}`;
  base = trimDotsAndSpaces(truncateToBytes(base, maxBaseBytes)) || fallbackName;

  return `${base}${extension}`;
};

// The fallback is a quoted-string, so `"` and `\` cannot appear in it unescaped; `%` is left out
// because some clients percent-decode `filename` (RFC 6266 appendix D).
const ASCII_FALLBACK_UNSAFE = /["\\%]/g;
const NON_PRINTABLE_ASCII_RUN = /[^\x20-\x7e]+/g;
const COMBINING_MARKS = /\p{M}/gu;

const toAsciiFallback = (fileName: string): string =>
  fileName
    .normalize("NFKD")
    .replaceAll(COMBINING_MARKS, "")
    .replaceAll(NON_PRINTABLE_ASCII_RUN, "_")
    .replaceAll(ASCII_FALLBACK_UNSAFE, "_");

// RFC 8187 `attr-char` excludes these, but `encodeURIComponent` leaves them as they are.
const encodeRfc8187 = (value: string): string =>
  encodeURIComponent(value).replaceAll(
    /['()*]/g,
    (character) => `%${(character.codePointAt(0) ?? 0).toString(16).toUpperCase()}`
  );

/**
 * `Content-Disposition: attachment` for `fileName`: an ASCII `filename` fallback plus the exact name
 * as `filename*=UTF-8''…`, which every current browser prefers. Pass a name from
 * {@link buildDownloadFileName}; this only encodes.
 */
export const buildAttachmentContentDisposition = (fileName: string): string =>
  `attachment; filename="${toAsciiFallback(fileName)}"; filename*=UTF-8''${encodeRfc8187(fileName)}`;
