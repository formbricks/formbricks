/**
 * A tiny independent zip reader for tests: reads the central directory and inflates each entry with
 * Node's zlib, so a test does not trust the writer (archiver) to read its own output back.
 */
import { inflateRawSync } from "node:zlib";

export type TZipEntry = { name: string; data: Buffer };

export const readZip = (zip: Buffer): TZipEntry[] => {
  let eocd = zip.length - 22;
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Not a zip: no end of central directory");
  const count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);

  const entries: TZipEntry[] = [];
  for (let index = 0; index < count; index++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error("Bad central directory entry");
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");

    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = zip.subarray(start, start + compressedSize);
    entries.push({ name, data: method === 8 ? inflateRawSync(raw) : Buffer.from(raw) });

    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
};
