import { describe, expect, test } from "vitest";
import { buildSampleExport } from "./__fixtures__/sample-export";
import { analysisColumnGroups, withoutColumnGroups } from "./column-groups";

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
