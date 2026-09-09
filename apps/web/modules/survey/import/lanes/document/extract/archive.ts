import { importError } from "../../../report";
import type { TImportIssue } from "../../../types";
import { ARCHIVE_MAX_ENTRIES, ARCHIVE_MAX_UNCOMPRESSED_BYTES } from "./types";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const EOCD_MIN_LENGTH = 22;
/** The EOCD record may be followed by a comment of up to 64 KiB. */
const EOCD_SEARCH_WINDOW = EOCD_MIN_LENGTH + 0xffff;

export type TArchiveSummary = { entries: number; uncompressedBytes: number };

/**
 * Reads the zip central directory without inflating anything: entry count and the declared
 * uncompressed total. Returns null when the bytes are not a readable zip.
 */
export function summarizeArchive(bytes: Buffer): TArchiveSummary | null {
  const start = Math.max(0, bytes.length - EOCD_SEARCH_WINDOW);
  let eocd = -1;
  for (let offset = bytes.length - EOCD_MIN_LENGTH; offset >= start; offset -= 1) {
    if (bytes.readUInt32LE(offset) === EOCD_SIGNATURE) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) {
    return null;
  }

  const entries = bytes.readUInt16LE(eocd + 10);
  const directoryOffset = bytes.readUInt32LE(eocd + 16);
  let cursor = directoryOffset;
  let uncompressedBytes = 0;

  for (let index = 0; index < entries; index += 1) {
    if (cursor + 46 > bytes.length || bytes.readUInt32LE(cursor) !== CENTRAL_HEADER_SIGNATURE) {
      return null;
    }
    uncompressedBytes += bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return { entries, uncompressedBytes };
}

/**
 * Zip guard for DOCX and XLSX (edge case #38): refuses archives with too many entries or a declared
 * uncompressed size far beyond anything a survey document needs, before a parser inflates them.
 */
export function guardArchive(bytes: Buffer): TImportIssue | null {
  const summary = summarizeArchive(bytes);
  if (!summary) {
    return importError({ code: "document_unreadable", vars: { detail: "The file is not a valid archive." } });
  }

  if (summary.entries > ARCHIVE_MAX_ENTRIES || summary.uncompressedBytes > ARCHIVE_MAX_UNCOMPRESSED_BYTES) {
    return importError({
      code: "archive_rejected",
      vars: { entries: summary.entries, uncompressedBytes: summary.uncompressedBytes },
    });
  }

  return null;
}
