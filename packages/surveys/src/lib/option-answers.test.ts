import { describe, expect, test } from "vitest";
import { dropOptionsFromAnswer } from "./option-answers";

const option = (id: string, name: string) => ({ id, label: { default: name, de: `${name} (de)` } });

const services = {
  id: "services",
  type: "multipleChoiceMulti",
  choices: [option("netflix", "Netflix"), option("disney", "Disney+"), option("other", "Other")],
};

describe("dropOptionsFromAnswer (ENG-6937)", () => {
  test("drops a hidden option's label from a multi select answer", () => {
    expect(
      dropOptionsFromAnswer(services, { choices: ["disney"] }, ["Netflix", "Disney+"], "default")
    ).toEqual(["Netflix"]);
  });

  test("drops it when the answer was given in another language before a switch (ENG-6938)", () => {
    expect(
      dropOptionsFromAnswer(services, { choices: ["disney"] }, ["Netflix (de)", "Disney+ (de)"], "default")
    ).toEqual(["Netflix (de)"]);
  });

  test("with 'other' hidden, a label in another language is a pick, not an other text", () => {
    expect(
      dropOptionsFromAnswer(services, { choices: ["other"] }, ["Netflix (de)", "My own"], "default")
    ).toEqual(["Netflix (de)"]);
  });

  test("a matrix answered in German loses a hidden row after a switch", () => {
    const grid = {
      id: "grid",
      type: "matrix",
      rows: [option("r1", "Netflix"), option("r2", "Disney+")],
      columns: [option("c1", "Good")],
    };
    expect(
      dropOptionsFromAnswer(
        grid,
        { rows: ["r2"] },
        { "Netflix (de)": "Good (de)", "Disney+ (de)": "Good (de)" },
        "default"
      )
    ).toEqual({ "Netflix (de)": "Good (de)" });
  });
});
