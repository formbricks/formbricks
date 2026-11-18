import { describe, expect, test } from "vitest";
import type { TIntegrationNotionDatabase } from "@formbricks/types/integration/notion";
import { getDatabaseProperties, getDatabaseTitle } from "./database";

// Notion's database objects as getNotionDatabases passes them through: with `title` rich text.
const notionDatabase = (extra: Record<string, unknown>): TIntegrationNotionDatabase => ({
  id: "db1",
  name: "",
  properties: {},
  ...extra,
});

describe("getDatabaseTitle", () => {
  test("reads the first rich-text segment of the title", () => {
    const database = notionDatabase({ title: [{ plain_text: "Feedback" }, { plain_text: " log" }] });

    expect(getDatabaseTitle(database)).toBe("Feedback");
  });

  test("names an untitled database with an empty string", () => {
    expect(getDatabaseTitle(notionDatabase({ title: [] }))).toBe("");
    expect(getDatabaseTitle(notionDatabase({}))).toBe("");
  });
});

describe("getDatabaseProperties", () => {
  test("returns the database's property map", () => {
    const properties = { Name: { id: "title", name: "Name", type: "title" } };

    expect(getDatabaseProperties(notionDatabase({ properties }))).toEqual(properties);
  });

  test("returns an empty map when no database is selected", () => {
    expect(getDatabaseProperties(null)).toEqual({});
    expect(getDatabaseProperties(undefined)).toEqual({});
  });
});
