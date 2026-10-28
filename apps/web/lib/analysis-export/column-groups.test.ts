import { describe, expect, test } from "vitest";
import { buildSampleExport } from "./__fixtures__/sample-export";
import { analysisColumnGroups, withoutColumnGroups } from "./column-groups";
import { createColumnStats } from "./column-stats";
import { buildDatamap } from "./datamap";
import { buildSpssSyntax } from "./spss-syntax";

const drain = async (exported: ReturnType<typeof buildSampleExport>) => {
  const rows = [];
  for await (const batch of exported.rows()) rows.push(...batch);
  return rows;
};

describe("analysisColumnGroups", () => {
  const exported = buildSampleExport("both");

  test("lists the response columns, then one entry per question, whatever number of option columns it has", () => {
    const groups = analysisColumnGroups(exported.columns);
    expect(groups.slice(0, 3).map((group) => group.id)).toEqual(["r:response_id", "r:language", "r:outcome"]);
    expect(groups[0].label).toBe("responseId");
    const questions = groups.filter((group) => group.id.startsWith("q:"));
    const questionIds = new Set(
      exported.columns.flatMap((column) => (column.question ? [column.question.id] : []))
    );
    expect(questions).toHaveLength(questionIds.size);
    expect(questions[0].label).toContain(" · ");
  });

  test("a multi-select lists its options under it, nothing else does", () => {
    const groups = analysisColumnGroups(exported.columns);
    const fruit = groups.find((group) => group.label.includes("fruit"))!;
    const options = groups.filter((group) => group.parentId === fruit.id);
    expect(options.map((group) => group.id)).toEqual(
      exported.columns
        .filter((column) => column.question?.type === "multipleChoiceMulti")
        .map((c) => `c:${c.name}`)
    );
    expect(options[0].label).toMatch(/^fruit_\w+ · /);
    expect(groups.filter((group) => group.parentId && group.parentId !== fruit.id)).toEqual([]);
  });
});

describe("withoutColumnGroups", () => {
  test("with nothing switched off it is the same export", () => {
    const exported = buildSampleExport("both");
    expect(withoutColumnGroups(exported, [])).toBe(exported);
  });

  test("drops the columns of a group and the cell at the same place of every row", async () => {
    const exported = buildSampleExport("both");
    const groups = analysisColumnGroups(exported.columns);
    const dropped = groups.find((group) => group.id.startsWith("q:"))!.id;
    const kept = withoutColumnGroups(exported, [dropped, "r:language"]);

    expect(kept.columns.some((column) => column.name === "language")).toBe(false);
    expect(kept.columns.some((column) => column.question && `q:${column.question.id}` === dropped)).toBe(
      false
    );

    const before = await drain(buildSampleExport("both"));
    const after = await drain(kept);
    expect(after).toHaveLength(before.length);
    for (const row of after) {
      expect(row.codes).toHaveLength(kept.columns.length);
      expect(row.labels).toHaveLength(kept.columns.length);
    }
    expect(after[0].codes?.[0]).toBe(before[0].codes?.[0]);
  });
});

describe("one option of a multi-select switched off", () => {
  const optionColumn = (exported: ReturnType<typeof buildSampleExport>) =>
    exported.columns.find(
      (column) => column.question?.type === "multipleChoiceMulti" && column.kind === "flag"
    )!;

  test("drops that column and its cell only, the question's other columns stay", async () => {
    const exported = buildSampleExport("both");
    const dropped = optionColumn(exported);
    const siblings = exported.columns.filter((c) => c.question?.id === dropped.question?.id);
    const kept = withoutColumnGroups(exported, [`c:${dropped.name}`]);

    expect(kept.columns).toHaveLength(exported.columns.length - 1);
    expect(kept.columns.map((c) => c.name)).not.toContain(dropped.name);
    expect(siblings.length).toBeGreaterThan(1);
    expect(kept.columns.filter((c) => c.question?.id === dropped.question?.id)).toHaveLength(
      siblings.length - 1
    );
    for (const row of await drain(kept)) expect(row.codes).toHaveLength(kept.columns.length);
  });

  test("the Datamap and the SPSS syntax follow the kept columns", () => {
    const exported = buildSampleExport("codes");
    const dropped = optionColumn(exported);
    const kept = withoutColumnGroups(exported, [`c:${dropped.name}`]);

    expect(JSON.stringify(buildDatamap(exported.columns, {}))).toContain(`"${dropped.name}"`);
    expect(JSON.stringify(buildDatamap(kept.columns, {}))).not.toContain(`"${dropped.name}"`);
    const syntax = (columns: typeof kept.columns) =>
      buildSpssSyntax({
        columns,
        display: "codes",
        stats: createColumnStats(columns.length).result(),
        unmappedColumns: new Set(),
      });
    expect(syntax(exported.columns)).toContain(dropped.name);
    expect(syntax(kept.columns)).not.toContain(dropped.name);
  });
});
