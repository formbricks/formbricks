import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { buildSampleExport } from "./__fixtures__/sample-export";
import { createColumnStats } from "./column-stats";
import { type TSpssInput, assignSpssNames, buildSpssSyntax, cutToBytes, spssString } from "./spss-syntax";
import type { TAnalysisColumn, TAnalysisExport, TAnswerDisplay } from "./types";
import { unmappedColumnNames } from "./unmapped-values";

const bytes = (text: string) => Buffer.byteLength(text, "utf8");

const drain = async (exported: TAnalysisExport, display: TAnswerDisplay): Promise<TSpssInput> => {
  const stats = createColumnStats(exported.columns.length);
  for await (const batch of exported.rows()) {
    for (const row of batch) stats.observe((display === "text" ? row.labels : row.codes) ?? []);
  }
  return {
    columns: exported.columns,
    display,
    stats: stats.result(),
    unmappedColumns: unmappedColumnNames(exported.summary()),
    timeZone: "UTC",
  };
};

const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__", name), "utf8");

describe("cutToBytes", () => {
  test("leaves a text that fits alone", () => {
    expect(cutToBytes("abc", 256)).toBe("abc");
  });

  test("cuts ASCII at the byte limit", () => {
    expect(cutToBytes("a".repeat(300), 256)).toBe("a".repeat(256));
  });

  test("cuts Arabic (2 bytes a letter) on a character boundary, never inside one", () => {
    const cut = cutToBytes("م".repeat(200), 255);
    expect(bytes(cut)).toBe(254);
    expect([...cut].every((char) => char === "م")).toBe(true);
  });

  test("never splits a 4-byte character such as an emoji", () => {
    const cut = cutToBytes(`${"a".repeat(255)}😀`, 256);
    expect(cut).toBe("a".repeat(255));
  });
});

describe("spssString", () => {
  test("doubles single quotes and wraps the text in them", () => {
    expect(spssString("it's")).toBe("'it''s'");
  });

  test("turns newlines, tabs and other control characters into spaces", () => {
    expect(spssString("a\r\nb\nc\td\u0000e")).toBe("'a b c d e'");
  });

  test("keeps Arabic as written", () => {
    expect(spssString("أحمر")).toBe("'أحمر'");
  });
});

describe("assignSpssNames", () => {
  const names = (list: string[]) => assignSpssNames(list);

  test("leaves a valid name alone", () => {
    expect(names(["q1", "fruit_apple", "ed_vip"])).toEqual(["q1", "fruit_apple", "ed_vip"]);
  });

  test("replaces characters SPSS refuses and starts a name with a letter", () => {
    expect(names(["my field", "1st", "a-b"])).toEqual(["my_field", "v_1st", "a_b"]);
  });

  test("keeps a name within 64 bytes", () => {
    const [name] = names(["a".repeat(80)]);
    expect(bytes(name)).toBeLessThanOrEqual(64);
  });

  test("does not hand out a reserved word", () => {
    expect(names(["and", "with"])).toEqual(["and_", "with_"]);
  });

  test("a name PSPP would read as the COMMENT command at the start of a line gets a suffix", () => {
    expect(names(["comment", "Comm", "comment1", "com"])).toEqual(["comment_", "Comm_", "comment1", "com"]);
  });

  test("drops trailing dots, and stays fast on a very long run of dots", () => {
    expect(names(["a..", "b.c.", "..."])).toEqual(["a", "b.c", "v_"]);
    const started = performance.now();
    const [name] = names([`${".".repeat(200_000)}x`]);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(bytes(name)).toBeLessThanOrEqual(64);
  });

  test("names are unique ignoring case", () => {
    expect(names(["Score", "score", "SCORE"])).toEqual(["Score", "score_2", "SCORE_3"]);
  });
});

describe("buildSpssSyntax on the sample export", () => {
  test.each([
    ["codes", "labels.codes.sps"],
    ["text", "labels.text.sps"],
    ["both", "labels.both.sps"],
  ] as const)("Display answers %s matches the golden file", async (display, file) => {
    const input = await drain(buildSampleExport(display), display);
    expect(buildSpssSyntax(input)).toBe(fixture(file));
  });

  test("every line stays under 250 bytes, even with long labels", async () => {
    const input = await drain(buildSampleExport("codes"), "codes");
    const long: TAnalysisColumn = {
      name: "q_long",
      kind: "code",
      source: "question",
      question: { id: "e9", code: "q_long", type: "multipleChoiceSingle", headline: "ص".repeat(400) },
      codes: [{ code: "1", label: "م".repeat(300) }],
    };
    const columns = [...input.columns, long];
    const stats = [...input.stats, { maxTextBytes: 0, maxNumberChars: 0, maxDecimals: 0 }];
    const syntax = buildSpssSyntax({ ...input, columns, stats });
    for (const line of syntax.split("\n")) expect(bytes(line)).toBeLessThan(250);
  });

  test("a variable label is cut to 256 bytes and a value label to 120", async () => {
    const input = await drain(buildSampleExport("codes"), "codes");
    const long: TAnalysisColumn = {
      name: "q_long",
      kind: "code",
      source: "question",
      question: { id: "e9", code: "q_long", type: "multipleChoiceSingle", headline: "ص".repeat(400) },
      codes: [{ code: "1", label: "م".repeat(300) }],
    };
    const syntax = buildSpssSyntax({
      ...input,
      columns: [long],
      stats: [{ maxTextBytes: 0, maxNumberChars: 1, maxDecimals: 0 }],
      unmappedColumns: new Set(),
    });
    const joined = syntax.replaceAll("' +\n    '", "");
    const variableLabel = /q_long '(ص+)'/.exec(joined)?.[1] ?? "";
    expect(bytes(variableLabel)).toBe(256);
    const valueLabel = /1 '(م+)'/.exec(joined)?.[1] ?? "";
    expect(bytes(valueLabel)).toBe(120);
  });

  test("user text never reaches a comment, however hostile", async () => {
    const input = await drain(buildSampleExport("codes"), "codes");
    const hostile: TAnalysisColumn = {
      name: "q_evil",
      kind: "code",
      source: "question",
      question: {
        id: "e9",
        code: "q_evil",
        type: "multipleChoiceSingle",
        headline: "x'.\nEXECUTE.\n* gotcha.",
      },
      codes: [{ code: "1", label: "y'. DELETE VARIABLES ALL." }],
    };
    const syntax = buildSpssSyntax({
      ...input,
      columns: [hostile],
      stats: [{ maxTextBytes: 0, maxNumberChars: 1, maxDecimals: 0 }],
      unmappedColumns: new Set(),
    });
    // A comment line is only ever one of ours.
    const comments = syntax.split("\n").filter((line) => line.startsWith("*"));
    expect(
      comments.every((line) => /^\* (Analysis export|Set the folder|Columns with answers)/.test(line))
    ).toBe(true);
    expect(syntax).toContain("'x''. EXECUTE. * gotcha.'");
    expect(syntax).toContain("1 'y''. DELETE VARIABLES ALL.'");
  });
});

describe("buildSpssSyntax decisions", () => {
  const codeColumn = (name: string, codes: string[]): TAnalysisColumn => ({
    name,
    kind: "code",
    source: "question",
    question: { id: `id_${name}`, code: name, type: "multipleChoiceSingle", headline: `Question ${name}` },
    codes: codes.map((code) => ({ code, label: `Label ${code}` })),
  });
  const stat = { maxTextBytes: 0, maxNumberChars: 0, maxDecimals: 0 };
  const build = (columns: TAnalysisColumn[], extra: Partial<TSpssInput> = {}) =>
    buildSpssSyntax({
      columns,
      display: "codes",
      stats: columns.map(() => stat),
      unmappedColumns: new Set(),
      ...extra,
    });

  test("a column is numeric only when every answer code is a plain integer", () => {
    const syntax = build([codeColumn("all_int", ["1", "02", "98"]), codeColumn("mixed", ["1", "x2"])]);
    expect(syntax).toContain("    all_int F2.0");
    expect(syntax).toMatch(/ {4}mixed A\d+/);
    expect(syntax).toContain("  '1' 'Label 1'");
  });

  test("the width of a numeric format covers the code as written, so 01 is not cut to 0", () => {
    expect(build([codeColumn("padded", ["01", "02"])])).toContain("    padded F2.0");
    const converted = build([codeColumn("padded", ["01", "02"])], {
      stats: [{ maxTextBytes: 9, maxNumberChars: 0, maxDecimals: 0 }],
      unmappedColumns: new Set(["padded"]),
    });
    expect(converted).toContain("ALTER TYPE padded (F2.0).");
  });

  test("codes that collide as numbers (01 and 1) are kept as text", () => {
    expect(build([codeColumn("dup", ["01", "1"])])).toMatch(/ {4}dup A2/);
  });

  test("a column of UNMAPPED cells is read as text, copied to _raw, then converted", () => {
    const syntax = build([codeColumn("q", ["1", "2"])], {
      stats: [{ maxTextBytes: 20, maxNumberChars: 0, maxDecimals: 0 }],
      unmappedColumns: new Set(["q"]),
    });
    expect(syntax).toContain("    q A20");
    expect(syntax).toContain("STRING q_raw (A20).\nCOMPUTE q_raw = q.\nALTER TYPE q (F1.0).");
  });

  test("a text-coded column holding UNMAPPED cells stays text, nothing to convert", () => {
    const syntax = build([codeColumn("q", ["a", "b"])], {
      stats: [{ maxTextBytes: 12, maxNumberChars: 0, maxDecimals: 0 }],
      unmappedColumns: new Set(["q"]),
    });
    expect(syntax).not.toContain("ALTER TYPE");
    expect(syntax).not.toContain("q_raw");
  });

  test("with Display answers Text every answer is text and carries no value labels", () => {
    const syntax = build([codeColumn("q", ["1", "2"])], {
      display: "text",
      stats: [{ maxTextBytes: 5, maxNumberChars: 0, maxDecimals: 0 }],
    });
    expect(syntax).toContain("    q A5");
    expect(syntax).not.toContain("VALUE LABELS");
  });

  test("a number column takes the width and decimals measured from the data", () => {
    const column: TAnalysisColumn = {
      name: "price",
      kind: "number",
      source: "question",
      question: { id: "p", code: "price", type: "openText", headline: "Price" },
    };
    const syntax = build([column], { stats: [{ maxTextBytes: 0, maxNumberChars: 6, maxDecimals: 2 }] });
    expect(syntax).toContain("    price F6.2");
    expect(syntax).toContain("(SCALE)");
  });

  test("blank is system-missing: the file never declares user-missing values", async () => {
    const input = await drain(buildSampleExport("codes"), "codes");
    expect(buildSpssSyntax(input)).not.toMatch(/MISSING VALUES/i);
  });

  test("a multi-select gets a multiple response set only with two or more option columns", () => {
    const flag = (name: string, option: string): TAnalysisColumn => ({
      name,
      kind: "flag",
      source: "question",
      question: { id: "m", code: "m", type: "multipleChoiceMulti", headline: "Pick" },
      option: { code: option, label: option },
    });
    expect(build([flag("m_a", "a")])).not.toContain("MRSETS");
    const syntax = build([flag("m_a", "a"), flag("m_b", "b")]);
    expect(syntax).toContain("/MDGROUP NAME=$m");
    expect(syntax).toContain("m_a m_b");
    expect(syntax).toContain("VALUE=1.");
  });

  test("the file reads UTF-8 text with a header row", () => {
    const syntax = build([codeColumn("q", ["1"])]);
    expect(syntax).toContain("/ENCODING='UTF8'");
    expect(syntax).toContain("/FIRSTCASE=2");
    expect(syntax).toContain("/TYPE=TXT");
  });

  test("it carries a CD line for the analyst to edit", () => {
    expect(build([codeColumn("q", ["1"])])).toMatch(/^CD '.*'\.$/m);
  });
});
