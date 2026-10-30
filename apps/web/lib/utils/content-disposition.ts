/**
 * File names and `Content-Disposition` headers for downloads (RFC 6266, RFC 8187).
 *
 * A download keeps the name its user gave the thing it holds — a survey called "Größe" downloads as
 * `Größe.formbricks.json`, an Arabic one under its Arabic name — so the name has to be made safe for
 * every file system it may land on, and the header has to carry it in UTF-8 with an ASCII fallback
 * for the clients that read only `filename`. Parsing lives next door in `file-download.ts`.
 */

/** The most bytes a file name may take on the common file systems (ext4, APFS, NTFS's 255 UTF-16 units). */
export const DOWNLOAD_FILE_NAME_MAX_BYTES = 255;

// Path separators and the characters Windows refuses anywhere in a name.
const FORBIDDEN_CHARACTERS = /[/\\:*?"<>|]/g;
// C0 and C1 controls, and the bidirectional marks and overrides that can make `exe.json` read as
// `nosj.exe`. Whitespace controls are turned into spaces first, so a tab still separates words.
const CONTROL_CHARACTERS = /[\p{Cc}\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;
const WHITESPACE_CONTROLS = /[\t\n\v\f\r\u0085\u2028\u2029]/g;
// A lone surrogate is not text and would make `encodeURIComponent` throw.
const LONE_SURROGATES = /\p{Cs}/gu;
const EDGE_DOTS_AND_SPACES = /^[.\s]+|[.\s]+$/g;
// CON, PRN, AUX, NUL, COM1–9 and LPT1–9 name devices on Windows, with or without an extension.
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

const encoder = new TextEncoder();

const cleanName = (name: string): string =>
  name
    .replaceAll(LONE_SURROGATES, "")
    .normalize("NFC")
    .replaceAll(WHITESPACE_CONTROLS, " ")
    .replaceAll(CONTROL_CHARACTERS, "")
    .replaceAll(FORBIDDEN_CHARACTERS, "")
    .replaceAll(/\s+/g, " ")
    .replaceAll(EDGE_DOTS_AND_SPACES, "");

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
  base = truncateToBytes(base, maxBaseBytes).replaceAll(EDGE_DOTS_AND_SPACES, "") || fallbackName;

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
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );

/**
 * `Content-Disposition: attachment` for `fileName`: an ASCII `filename` fallback plus the exact name
 * as `filename*=UTF-8''…`, which every current browser prefers. Pass a name from
 * {@link buildDownloadFileName}; this only encodes.
 */
export const buildAttachmentContentDisposition = (fileName: string): string =>
  `attachment; filename="${toAsciiFallback(fileName)}"; filename*=UTF-8''${encodeRfc8187(fileName)}`;
