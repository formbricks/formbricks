/**
 * Counts the rows of an export while it downloads, so the modal can say "1,200 of 5,000 responses" instead
 * of a byte count. The route streams a CSV with one line per row (line breaks inside a cell are turned into
 * spaces), so the rows received are the lines received less the header. A zip carries the data CSV as its
 * first file, deflated: that file is inflated here as it arrives, which is the one place the rows can be read.
 */

const ZIP_LOCAL_HEADER_SIGNATURE = 0x04034b50;
const ZIP_LOCAL_HEADER_SIZE = 30;
const ZIP_DEFLATE = 8;
const LINE_FEED = 10;

export type TRowCounter = { write: (chunk: Uint8Array) => void };

const concat = (first: Uint8Array, second: Uint8Array): Uint8Array => {
  const joined = new Uint8Array(first.length + second.length);
  joined.set(first);
  joined.set(second, first.length);
  return joined;
};

/** Where the first file's compressed bytes start, or `null` while the header is incomplete or not a deflated file. */
const firstFileStart = (head: Uint8Array): number | "unsupported" | null => {
  if (head.length < ZIP_LOCAL_HEADER_SIZE) return null;
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  if (view.getUint32(0, true) !== ZIP_LOCAL_HEADER_SIGNATURE || view.getUint16(8, true) !== ZIP_DEFLATE) {
    return "unsupported";
  }
  const start = ZIP_LOCAL_HEADER_SIZE + view.getUint16(26, true) + view.getUint16(28, true);
  return head.length < start ? null : start;
};

export const createRowCounter = (output: "csv" | "zip", onRows: (rows: number) => void): TRowCounter => {
  let lines = 0;
  const count = (text: Uint8Array): void => {
    for (const byte of text) if (byte === LINE_FEED) lines += 1;
    onRows(Math.max(0, lines - 1));
  };
  if (output === "csv") return { write: count };

  let head: Uint8Array = new Uint8Array(0);
  let writer: WritableStreamDefaultWriter<BufferSource> | null = null;
  let unsupported = typeof DecompressionStream === "undefined";

  const startInflating = (compressed: Uint8Array): void => {
    const inflate = new DecompressionStream("deflate-raw");
    writer = inflate.writable.getWriter();
    // The bytes after the first file are not deflate data: that ends the stream with an error, and the count stops there.
    inflate.readable.pipeTo(new WritableStream({ write: count })).catch(() => undefined);
    writer.write(compressed).catch(() => undefined);
  };

  return {
    write: (chunk) => {
      if (unsupported) return;
      if (writer) {
        writer.write(chunk).catch(() => undefined);
        return;
      }
      head = concat(head, chunk);
      const start = firstFileStart(head);
      if (start === "unsupported") unsupported = true;
      else if (start !== null) startInflating(head.subarray(start));
    },
  };
};
