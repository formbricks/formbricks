import { Inflate } from "fflate";
import {
  SURVEY_IMPORT_ZIP_MAX_COMPRESSION_RATIO,
  SURVEY_IMPORT_ZIP_MAX_ENTRIES,
  SURVEY_IMPORT_ZIP_MAX_INFLATED_BYTES,
  SURVEY_IMPORT_ZIP_MAX_PART_BYTES,
} from "../limits";
import { SurveyImportFileTooLargeError, surveyImportFileUnreadable } from "./errors";

/**
 * A `.docx` or `.xlsx` read as the zip archive it is (ENG-6848), held to the upload's zip limits.
 *
 * Opening it reads only the central directory and checks what it declares — the entry count, then each
 * entry's compression ratio and inflated size, and their total — before a single byte is inflated, so a
 * zip bomb is refused for the price of reading its directory. `read` then inflates one entry with
 * fflate's streaming inflater, a few kilobytes of input at a time, counting what comes out against the
 * same limits: a directory can lie, and the count is what holds when it does.
 *
 * The central directory is read here rather than through fflate's `unzipSync`, which neither exposes
 * where an entry's data starts nor counts what it inflates: it sizes its output from the directory, so a
 * lying directory makes it decode an entry whole whatever the entry really holds.
 */
export interface TZipArchive {
  /** The entries' names, in the directory's order. */
  readonly names: readonly string[];
  /**
   * An entry's inflated bytes, or `null` when the archive has no entry by that name. Throws a 413 error
   * past a limit, a 422 for an entry it cannot read (encrypted, damaged, or not the size it declared).
   */
  read: (name: string) => Uint8Array | null;
}

interface TZipEntry {
  name: string;
  flags: number;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

const END_SIGNATURE = 0x06054b50;
const END_LENGTH = 22;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_LOCATOR_LENGTH = 20;
const ZIP64_END_SIGNATURE = 0x06064b50;
const ZIP64_END_LENGTH = 56;
const CENTRAL_SIGNATURE = 0x02014b50;
const CENTRAL_LENGTH = 46;
const LOCAL_SIGNATURE = 0x04034b50;
const LOCAL_LENGTH = 30;
const ZIP64_EXTRA_ID = 0x0001;
/** A 32-bit field set to all ones: the real value is in the entry's ZIP64 extra field. */
const ZIP64_U32 = 0xffffffff;
const MAX_COMMENT_LENGTH = 0xffff;

const FLAG_ENCRYPTED = 0x1;
const METHOD_STORED = 0;
const METHOD_DEFLATED = 8;

/**
 * Compressed bytes handed to the inflater at once. DEFLATE inflates at most about 1,032:1, so one step
 * yields at most ~8 MiB before the count can stop it.
 */
const INFLATE_STEP_BYTES = 8 * 1024;

const XML_PART = /\.(xml|rels)$/i;

const refuseTooLarge = (
  limit: "zip_entries" | "zip_inflated_size" | "zip_part_size" | "zip_compression_ratio"
): SurveyImportFileTooLargeError => {
  switch (limit) {
    case "zip_entries":
      return new SurveyImportFileTooLargeError(
        limit,
        `The archive has more than ${SURVEY_IMPORT_ZIP_MAX_ENTRIES} entries`
      );
    case "zip_inflated_size":
      return new SurveyImportFileTooLargeError(
        limit,
        `The archive inflates to more than ${SURVEY_IMPORT_ZIP_MAX_INFLATED_BYTES} bytes`
      );
    case "zip_part_size":
      return new SurveyImportFileTooLargeError(
        limit,
        `An XML part of the archive inflates to more than ${SURVEY_IMPORT_ZIP_MAX_PART_BYTES} bytes`
      );
    case "zip_compression_ratio":
      return new SurveyImportFileTooLargeError(
        limit,
        `An entry of the archive is compressed more than ${SURVEY_IMPORT_ZIP_MAX_COMPRESSION_RATIO}:1`
      );
  }
};

const unreadable = (reason: string) => surveyImportFileUnreadable(reason);

class ZipReader {
  private readonly view: DataView;

  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  has(offset: number, length: number): boolean {
    return offset >= 0 && offset + length <= this.bytes.length;
  }

  u16(offset: number): number {
    return this.view.getUint16(offset, true);
  }

  u32(offset: number): number {
    return this.view.getUint32(offset, true);
  }

  /** An 8-byte length or offset; past 2^53 it cannot be a real one in a 15 MiB file. */
  u64(offset: number): number {
    const value = this.u32(offset) + this.u32(offset + 4) * 2 ** 32;
    if (!Number.isSafeInteger(value)) throw unreadable("The archive's directory is damaged");
    return value;
  }
}

interface TDirectoryLocation {
  entryCount: number;
  offset: number;
  size: number;
  /** Where the records after the directory start; the directory must end before it. */
  end: number;
}

/** The end of central directory record, searched backwards past its variable-length comment. */
const findEndRecord = (reader: ZipReader): number => {
  const last = reader.bytes.length - END_LENGTH;
  const first = Math.max(0, last - MAX_COMMENT_LENGTH);
  for (let offset = last; offset >= first; offset -= 1) {
    if (reader.u32(offset) === END_SIGNATURE) return offset;
  }
  throw unreadable("The file is not a zip archive");
};

const locateDirectory = (reader: ZipReader): TDirectoryLocation => {
  const endOffset = findEndRecord(reader);
  let entryCount = reader.u16(endOffset + 10);
  let size = reader.u32(endOffset + 12);
  let offset = reader.u32(endOffset + 16);
  let end = endOffset;
  const disksSplit = reader.u16(endOffset + 4) !== 0 || reader.u16(endOffset + 6) !== 0;

  const locator = endOffset - ZIP64_LOCATOR_LENGTH;
  if (reader.has(locator, ZIP64_LOCATOR_LENGTH) && reader.u32(locator) === ZIP64_LOCATOR_SIGNATURE) {
    const zip64End = reader.u64(locator + 8);
    if (!reader.has(zip64End, ZIP64_END_LENGTH) || reader.u32(zip64End) !== ZIP64_END_SIGNATURE) {
      throw unreadable("The archive's directory is damaged");
    }
    entryCount = reader.u64(zip64End + 32);
    size = reader.u64(zip64End + 40);
    offset = reader.u64(zip64End + 48);
    end = zip64End;
  }

  // The count alone decides, before a single entry is walked: a directory claiming millions of entries
  // costs nothing to refuse.
  if (entryCount > SURVEY_IMPORT_ZIP_MAX_ENTRIES) throw refuseTooLarge("zip_entries");
  if (disksSplit) throw unreadable("The archive is split across several files");
  if (offset + size > end) throw unreadable("The archive's directory is damaged");

  return { entryCount, offset, size, end };
};

/** The ZIP64 extra field's values, for the 32-bit fields that are all ones. */
const readZip64Extra = (
  reader: ZipReader,
  entry: Omit<TZipEntry, "name">,
  extraStart: number,
  extraEnd: number
): Omit<TZipEntry, "name"> => {
  const needs = [
    entry.uncompressedSize === ZIP64_U32,
    entry.compressedSize === ZIP64_U32,
    entry.localHeaderOffset === ZIP64_U32,
  ];
  if (!needs.includes(true)) return entry;

  for (let position = extraStart; position + 4 <= extraEnd; position += 4 + reader.u16(position + 2)) {
    if (reader.u16(position) !== ZIP64_EXTRA_ID) continue;

    const fieldEnd = position + 4 + reader.u16(position + 2);
    let cursor = position + 4;
    const next = (): number => {
      if (cursor + 8 > fieldEnd) throw unreadable("The archive's directory is damaged");
      const value = reader.u64(cursor);
      cursor += 8;
      return value;
    };
    return {
      ...entry,
      uncompressedSize: needs[0] ? next() : entry.uncompressedSize,
      compressedSize: needs[1] ? next() : entry.compressedSize,
      localHeaderOffset: needs[2] ? next() : entry.localHeaderOffset,
    };
  }
  throw unreadable("The archive's directory is damaged");
};

const nameDecoder = new TextDecoder();

/** Walk the central directory, holding each entry to the limits on what it declares. */
const readDirectory = (reader: ZipReader, directory: TDirectoryLocation): Map<string, TZipEntry> => {
  const entries = new Map<string, TZipEntry>();
  const directoryEnd = directory.offset + directory.size;
  let declaredTotal = 0;
  let position = directory.offset;

  for (let index = 0; index < directory.entryCount; index += 1) {
    if (position + CENTRAL_LENGTH > directoryEnd || reader.u32(position) !== CENTRAL_SIGNATURE) {
      throw unreadable("The archive's directory is damaged");
    }
    const nameLength = reader.u16(position + 28);
    const extraLength = reader.u16(position + 30);
    const commentLength = reader.u16(position + 32);
    const nameStart = position + CENTRAL_LENGTH;
    const extraStart = nameStart + nameLength;
    const next = extraStart + extraLength + commentLength;
    if (next > directoryEnd) throw unreadable("The archive's directory is damaged");

    const name = nameDecoder.decode(reader.bytes.subarray(nameStart, extraStart));
    const entry: TZipEntry = {
      name,
      ...readZip64Extra(
        reader,
        {
          flags: reader.u16(position + 8),
          method: reader.u16(position + 10),
          compressedSize: reader.u32(position + 20),
          uncompressedSize: reader.u32(position + 24),
          localHeaderOffset: reader.u32(position + 42),
        },
        extraStart,
        extraStart + extraLength
      ),
    };

    if (entries.has(name)) throw unreadable("The archive lists the same entry twice");
    if (entry.uncompressedSize > entry.compressedSize * SURVEY_IMPORT_ZIP_MAX_COMPRESSION_RATIO) {
      throw refuseTooLarge("zip_compression_ratio");
    }
    if (XML_PART.test(name) && entry.uncompressedSize > SURVEY_IMPORT_ZIP_MAX_PART_BYTES) {
      throw refuseTooLarge("zip_part_size");
    }
    declaredTotal += entry.uncompressedSize;
    if (declaredTotal > SURVEY_IMPORT_ZIP_MAX_INFLATED_BYTES) throw refuseTooLarge("zip_inflated_size");

    entries.set(name, entry);
    position = next;
  }

  return entries;
};

/** Where an entry's compressed bytes are, from its local header. */
const locateData = (reader: ZipReader, entry: TZipEntry, dataEnd: number): Uint8Array => {
  const header = entry.localHeaderOffset;
  if (!reader.has(header, LOCAL_LENGTH) || reader.u32(header) !== LOCAL_SIGNATURE) {
    throw unreadable("An entry of the archive is damaged");
  }
  const start = header + LOCAL_LENGTH + reader.u16(header + 26) + reader.u16(header + 28);
  const end = start + entry.compressedSize;
  if (end > dataEnd) throw unreadable("An entry of the archive is damaged");
  return reader.bytes.subarray(start, end);
};

/**
 * Open `bytes` as a zip archive, checking its central directory against the zip limits. Throws a 413
 * error past one, a 422 for bytes that are not a readable archive.
 */
export const openZipArchive = (bytes: Uint8Array): TZipArchive => {
  const reader = new ZipReader(bytes);
  if (bytes.length < END_LENGTH) throw unreadable("The file is not a zip archive");

  const directory = locateDirectory(reader);
  const entries = readDirectory(reader, directory);
  let inflatedTotal = 0;

  const read = (name: string): Uint8Array | null => {
    const entry = entries.get(name);
    if (!entry) return null;
    if (entry.flags & FLAG_ENCRYPTED) throw unreadable("An entry of the archive is encrypted");
    if (entry.method !== METHOD_STORED && entry.method !== METHOD_DEFLATED) {
      throw unreadable("An entry of the archive uses an unsupported compression method");
    }

    const data = locateData(reader, entry, directory.offset);
    const isXmlPart = XML_PART.test(name);
    let entryBytes = 0;
    const count = (length: number) => {
      entryBytes += length;
      inflatedTotal += length;
      if (isXmlPart && entryBytes > SURVEY_IMPORT_ZIP_MAX_PART_BYTES) throw refuseTooLarge("zip_part_size");
      if (entryBytes > entry.compressedSize * SURVEY_IMPORT_ZIP_MAX_COMPRESSION_RATIO) {
        throw refuseTooLarge("zip_compression_ratio");
      }
      if (inflatedTotal > SURVEY_IMPORT_ZIP_MAX_INFLATED_BYTES) throw refuseTooLarge("zip_inflated_size");
    };

    let content: Uint8Array;
    if (entry.method === METHOD_STORED) {
      count(data.length);
      content = data.slice();
    } else {
      content = inflate(data, count);
    }

    if (content.length !== entry.uncompressedSize) {
      throw unreadable("An entry of the archive is not the size its directory declares");
    }
    return content;
  };

  return { names: [...entries.keys()], read };
};

/** DEFLATE `data` a step at a time, handing each output chunk to `count` before keeping it. */
const inflate = (data: Uint8Array, count: (length: number) => void): Uint8Array => {
  const chunks: Uint8Array[] = [];
  let length = 0;
  const inflater = new Inflate((chunk) => {
    count(chunk.length);
    chunks.push(chunk);
    length += chunk.length;
  });

  try {
    for (let offset = 0; offset < data.length || offset === 0; offset += INFLATE_STEP_BYTES) {
      const end = Math.min(offset + INFLATE_STEP_BYTES, data.length);
      inflater.push(data.subarray(offset, end), end === data.length);
      if (end === data.length) break;
    }
  } catch (error) {
    if (error instanceof SurveyImportFileTooLargeError) throw error;
    throw unreadable("An entry of the archive is damaged");
  }

  const content = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    content.set(chunk, offset);
    offset += chunk.length;
  }
  return content;
};
