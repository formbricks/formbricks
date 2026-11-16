import { describe, expect, test } from "vitest";
import { nameRefusalsBySheetRow } from "./refusal-rows";

const draft = {
  blocks: [
    { elements: [{ id: "visit" }] },
    {
      elements: [
        {
          id: "pick",
          choices: [{ id: "search" }, { id: "friend" }],
        },
        { id: "grid", rows: [{ id: "row.a" }], columns: [{ id: "col-1" }] },
      ],
    },
  ],
};

const read = {
  rows: [
    { row: 2, key: "element.visit.headline" },
    { row: 3, key: "element.pick.headline" },
    { row: 5, key: "element.pick.choice.friend.label" },
    { row: 7, key: "element.grid.headline" },
    { row: 8, key: "element.grid.row.row%2Ea.label" },
    { row: 9, key: "" },
  ],
} as never;

const refusal = (name: string) => ({ name, reason: "locked", code: "immutable_option_text" as const });

describe("nameRefusalsBySheetRow", () => {
  test("names an option's text by its row and language", () => {
    expect(
      nameRefusalsBySheetRow([refusal("survey.blocks.1.elements.0.choices.1.label.en-US")], draft, read, [
        "en-US",
        "de-DE",
      ])
    ).toEqual([{ ...refusal(""), name: "R5 (en-US)" }]);
  });

  test("names a matrix row by its row, encoding ids as keys do", () => {
    expect(
      nameRefusalsBySheetRow([refusal("survey.blocks.1.elements.1.rows.0.label.de-DE")], draft, read, [
        "en-US",
        "de-DE",
      ])[0].name
    ).toBe("R8 (de-DE)");
  });

  test("names a question-level problem by the question's headline row", () => {
    expect(
      nameRefusalsBySheetRow([refusal("survey.blocks.0.elements.0.type")], draft, read, ["en-US"])[0].name
    ).toBe("R2");
  });

  test("leaves a name that leads to no row of the sheet as it is", () => {
    const params = [refusal("survey.type"), refusal("survey.blocks.9.elements.0.headline.en-US")];
    expect(nameRefusalsBySheetRow(params, draft, read, ["en-US"])).toEqual(params);
  });
});
