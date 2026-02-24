import { describe, expect, test } from "vitest";
import { TSourceField } from "./types";
import { getConnectorOptions, parseCSVColumnsToFields } from "./utils";

const mockT = (key: string) => key;

describe("getConnectorOptions", () => {
  test("returns formbricks and csv options", () => {
    const options = getConnectorOptions(mockT as never);
    expect(options).toHaveLength(2);
    expect(options[0].id).toBe("formbricks");
    expect(options[1].id).toBe("csv");
  });

  test("both options are enabled by default", () => {
    const options = getConnectorOptions(mockT as never);
    expect(options.every((o) => !o.disabled)).toBe(true);
  });

  test("uses translation keys for name and description", () => {
    const options = getConnectorOptions(mockT as never);
    expect(options[0].name).toBe("environments.unify.formbricks_surveys");
    expect(options[0].description).toBe("environments.unify.source_connect_formbricks_description");
    expect(options[1].name).toBe("environments.unify.csv_import");
    expect(options[1].description).toBe("environments.unify.source_connect_csv_description");
  });
});

describe("parseCSVColumnsToFields", () => {
  test("parses comma-separated column names into source fields", () => {
    const result = parseCSVColumnsToFields("name,email,score");
    expect(result).toHaveLength(3);
    expect(result).toEqual<TSourceField[]>([
      { id: "name", name: "name", type: "string", sampleValue: "Sample name" },
      { id: "email", name: "email", type: "string", sampleValue: "Sample email" },
      { id: "score", name: "score", type: "string", sampleValue: "Sample score" },
    ]);
  });

  test("trims whitespace from column names", () => {
    const result = parseCSVColumnsToFields(" name , email , score ");
    expect(result[0].id).toBe("name");
    expect(result[1].id).toBe("email");
    expect(result[2].id).toBe("score");
  });

  test("handles single column", () => {
    const result = parseCSVColumnsToFields("feedback");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("feedback");
  });

  test("generates sample values from column names", () => {
    const result = parseCSVColumnsToFields("rating,comment");
    expect(result[0].sampleValue).toBe("Sample rating");
    expect(result[1].sampleValue).toBe("Sample comment");
  });
});
