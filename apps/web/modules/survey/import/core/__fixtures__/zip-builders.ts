import { type Zippable, zipSync } from "fflate";

/**
 * Zip archives for the reader's tests: real ones from fflate, then edited the way a hostile file would
 * be — a central directory that lies about sizes or counts — since no zip writer produces those.
 */

const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

/** An archive of `files`, deflated at `level` (0 stores them). */
export const zipOf = (
  files: Record<string, Uint8Array | string>,
  level: 0 | 1 | 6 | 9 = 6
): Uint8Array<ArrayBuffer> => {
  const input: Zippable = {};
  for (const [name, content] of Object.entries(files)) {
    const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
    input[name] = [bytes, { level }];
  }
  // Copied into a plain ArrayBuffer, so the bytes go into a File or Blob as they are.
  return new Uint8Array(zipSync(input));
};

/** `length` bytes of hexadecimal text: compresses about 2:1, well inside any ratio limit. */
export const hexText = (length: number): Uint8Array => {
  const alphabet = new TextEncoder().encode("0123456789abcdef");
  const bytes = new Uint8Array(length);
  let state = 0x9e3779b9;
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    bytes[index] = alphabet[(state >>> 0) & 15];
  }
  return bytes;
};

export interface TCentralEntry {
  /** Where the entry's central directory header starts. */
  offset: number;
  nameOffset: number;
  compressedSize: number;
  uncompressedSize: number;
  /** Where the entry's compressed bytes start, after its local header. */
  dataOffset: number;
}

/** The central directory header of the entry called `name`. */
export const findCentralEntry = (archive: Uint8Array, name: string): TCentralEntry => {
  const data = view(archive);
  for (let offset = 0; offset + 46 <= archive.length; offset += 1) {
    if (data.getUint32(offset, true) !== CENTRAL_SIGNATURE) continue;
    const nameLength = data.getUint16(offset + 28, true);
    const entryName = new TextDecoder().decode(archive.subarray(offset + 46, offset + 46 + nameLength));
    if (entryName !== name) continue;

    const local = data.getUint32(offset + 42, true);
    return {
      offset,
      nameOffset: offset + 46,
      compressedSize: data.getUint32(offset + 20, true),
      uncompressedSize: data.getUint32(offset + 24, true),
      dataOffset: local + 30 + data.getUint16(local + 26, true) + data.getUint16(local + 28, true),
    };
  }
  throw new Error(`No central directory entry named ${name}`);
};

/**
 * A copy that declares other sizes for `name`, in its central directory entry and its local header
 * alike: a lie told consistently, which only counting what the entry inflates to can catch.
 */
export const setDeclaredSizes = (
  archive: Uint8Array,
  name: string,
  sizes: { compressedSize?: number; uncompressedSize?: number }
): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(archive);
  const data = view(copy);
  const { offset } = findCentralEntry(copy, name);
  const local = data.getUint32(offset + 42, true);
  if (sizes.compressedSize !== undefined) {
    data.setUint32(offset + 20, sizes.compressedSize, true);
    data.setUint32(local + 18, sizes.compressedSize, true);
  }
  if (sizes.uncompressedSize !== undefined) {
    data.setUint32(offset + 24, sizes.uncompressedSize, true);
    data.setUint32(local + 22, sizes.uncompressedSize, true);
  }
  return copy;
};

/** A copy that sets these general-purpose flags on `name`, in both of its headers (bit 0: encrypted). */
export const setFlags = (archive: Uint8Array, name: string, flags: number): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(archive);
  const data = view(copy);
  const { offset } = findCentralEntry(copy, name);
  data.setUint16(offset + 8, flags, true);
  data.setUint16(data.getUint32(offset + 42, true) + 6, flags, true);
  return copy;
};

/** A copy whose end record declares `count` entries. */
export const setDeclaredEntryCount = (archive: Uint8Array, count: number): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(archive);
  const data = view(copy);
  for (let offset = copy.length - 22; offset >= 0; offset -= 1) {
    if (data.getUint32(offset, true) !== END_SIGNATURE) continue;
    data.setUint16(offset + 8, count, true);
    data.setUint16(offset + 10, count, true);
    return copy;
  }
  throw new Error("No end of central directory record");
};

/**
 * A copy whose end record says `count` entries are on this disk, leaving the total as it is: what a
 * reader counting the other field sees as more entries, or fewer, than the directory holds.
 */
export const setDiskEntryCount = (archive: Uint8Array, count: number): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(archive);
  const data = view(copy);
  for (let offset = copy.length - 22; offset >= 0; offset -= 1) {
    if (data.getUint32(offset, true) !== END_SIGNATURE) continue;
    data.setUint16(offset + 8, count, true);
    return copy;
  }
  throw new Error("No end of central directory record");
};

/** A copy whose local header for `name` names it `localName` instead (same length), or declares other sizes. */
export const editLocalHeader = (
  archive: Uint8Array,
  name: string,
  edit: { localName?: string; compressedSize?: number; uncompressedSize?: number }
): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(archive);
  const data = view(copy);
  const { offset } = findCentralEntry(copy, name);
  const local = data.getUint32(offset + 42, true);
  if (edit.localName !== undefined) {
    const encoded = new TextEncoder().encode(edit.localName);
    if (encoded.length !== data.getUint16(local + 26, true))
      throw new Error("The local name must keep its length");
    copy.set(encoded, local + 30);
  }
  if (edit.compressedSize !== undefined) data.setUint32(local + 18, edit.compressedSize, true);
  if (edit.uncompressedSize !== undefined) data.setUint32(local + 22, edit.uncompressedSize, true);
  return copy;
};
