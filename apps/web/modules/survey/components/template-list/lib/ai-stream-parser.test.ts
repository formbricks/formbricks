import { describe, expect, test } from "vitest";
import { NdjsonParser } from "./ai-stream-parser";

interface Frame {
  seq: number;
}

describe("NdjsonParser", () => {
  test("reassembles an object split across two chunks", () => {
    const parser = new NdjsonParser<Frame>();

    expect(parser.push('{"seq":')).toEqual([]);
    expect(parser.push("1}\n")).toEqual([{ seq: 1 }]);
  });

  test("returns every object when several arrive in one chunk", () => {
    const parser = new NdjsonParser<Frame>();

    expect(parser.push('{"seq":1}\n{"seq":2}\n{"seq":3}\n')).toEqual([{ seq: 1 }, { seq: 2 }, { seq: 3 }]);
  });

  test("holds a partial trailing line until the rest arrives", () => {
    const parser = new NdjsonParser<Frame>();

    expect(parser.push('{"seq":1}\n{"seq":')).toEqual([{ seq: 1 }]);
    expect(parser.push("2}\n")).toEqual([{ seq: 2 }]);
  });

  test("tolerates CRLF line endings from an intermediary", () => {
    const parser = new NdjsonParser<Frame>();

    expect(parser.push('{"seq":1}\r\n{"seq":2}\r\n')).toEqual([{ seq: 1 }, { seq: 2 }]);
  });

  test("skips blank lines", () => {
    const parser = new NdjsonParser<Frame>();

    expect(parser.push('\n\n{"seq":1}\n\n')).toEqual([{ seq: 1 }]);
  });

  test("flush yields a final line that arrived without a trailing newline", () => {
    const parser = new NdjsonParser<Frame>();

    expect(parser.push('{"seq":1}\n{"seq":2}')).toEqual([{ seq: 1 }]);
    expect(parser.flush()).toEqual([{ seq: 2 }]);
  });

  test("flush yields nothing when the stream ended cleanly", () => {
    const parser = new NdjsonParser<Frame>();

    parser.push('{"seq":1}\n');
    expect(parser.flush()).toEqual([]);
  });

  test("drops a malformed line instead of throwing", () => {
    // One unreadable frame should cost a skipped snapshot, not the whole generation.
    const parser = new NdjsonParser<Frame>();

    expect(parser.push('{"seq":1}\nnot json\n{"seq":2}\n')).toEqual([{ seq: 1 }, { seq: 2 }]);
  });
});
