import { describe, expect, test } from "vitest";
import { MEMBER_ATTRIBUTE_MAX_BULK_ROWS } from "@/modules/ee/member-attributes/lib/limits";
import {
  buildMemberCsvExport,
  buildMemberCsvTemplate,
  joinAttributeCell,
  planMemberCsvImport,
  splitAttributeCell,
  toBulkAttributeRows,
} from "./member-csv-import";

const attributeKeys = [
  { key: "country", label: "Country" },
  { key: "city", label: "City" },
];

const headers = ["Full Name", "Email Address", "Organization Role", "Teams", "country", "City", "Shoe size"];

describe("planMemberCsvImport", () => {
  test("invites new emails, updates existing members and invites, and maps columns by key or label", () => {
    const plan = planMemberCsvImport({
      headers,
      rows: [
        {
          "Full Name": "Anna",
          "Email Address": "Anna@Example.com",
          country: "Sweden; Norway",
          City: "Malmö",
        },
        { "Full Name": "Ben", "Email Address": "ben@example.com", country: "Germany", City: "" },
        {
          "Full Name": "Cleo",
          "Email Address": "cleo@example.com",
          "Organization Role": "Member",
          country: "",
        },
        { "Full Name": "Dan", "Email Address": "dan@example.com", country: "Spain,Portugal" },
      ],
      attributeKeys,
      existingEmails: ["anna@example.com", "BEN@example.com"],
    });

    expect(plan.summary).toEqual({ rows: 4, invites: 2, updates: 2, invalid: 0 });
    expect(plan.entries.map((entry) => entry.action)).toEqual(["update", "update", "invite", "invite"]);
    expect(plan.attributeColumns).toEqual(attributeKeys);
    expect(plan.unknownColumns).toEqual(["Shoe size"]);
    expect(plan.entries[0]).toMatchObject({
      email: "anna@example.com",
      attributes: { country: ["Sweden", "Norway"], city: ["Malmö"] },
    });
    // An empty cell clears the key.
    expect(plan.entries[1].attributes.city).toEqual([]);
    expect(plan.entries[3].attributes.country).toEqual(["Spain", "Portugal"]);
  });

  test("marks rows without a usable email, repeated emails and values past a cap as invalid", () => {
    const plan = planMemberCsvImport({
      headers: ["Email Address", "country"],
      rows: [
        { "Email Address": "" },
        { "Email Address": "not-an-email" },
        { "Email Address": "a@example.com" },
        { "Email Address": "A@example.com" },
        { "Email Address": "b@example.com", country: "x".repeat(256) },
      ],
      attributeKeys,
      existingEmails: [],
    });

    expect(plan.entries.map((entry) => entry.problems)).toEqual([
      ["missing_email"],
      ["invalid_email"],
      [],
      ["duplicate_email"],
      ["value_too_long"],
    ]);
    expect(plan.summary.invalid).toBe(4);
  });

  test("handles a 200-row file in one plan and refuses past the bulk cap", () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({
      "Email Address": `p${i}@example.com`,
      country: "Sweden",
    }));
    const plan = planMemberCsvImport({
      headers: ["Email Address", "country"],
      rows,
      attributeKeys,
      existingEmails: rows.slice(0, 120).map((row) => row["Email Address"]),
    });
    expect(plan.summary).toEqual({ rows: 200, invites: 80, updates: 120, invalid: 0 });
    expect(toBulkAttributeRows(plan)).toHaveLength(200);

    const big = Array.from({ length: MEMBER_ATTRIBUTE_MAX_BULK_ROWS + 1 }, (_, i) => ({
      "Email Address": `q${i}@example.com`,
    }));
    const capped = planMemberCsvImport({
      headers: ["Email Address"],
      rows: big,
      attributeKeys,
      existingEmails: [],
    });
    expect(capped.tooManyRows).toBe(true);
    expect(capped.entries).toHaveLength(MEMBER_ATTRIBUTE_MAX_BULK_ROWS);
  });

  test("sends no attribute rows for a file without attribute columns", () => {
    const plan = planMemberCsvImport({
      headers: ["Email Address"],
      rows: [{ "Email Address": "a@example.com" }],
      attributeKeys,
      existingEmails: [],
    });
    expect(toBulkAttributeRows(plan)).toEqual([]);
  });
});

describe("buildMemberCsvTemplate", () => {
  test("adds a column per attribute key and defangs formula-like keys", () => {
    const csv = buildMemberCsvTemplate([
      { key: "country", label: "Country" },
      { key: "=cmd", label: "x" },
    ]);
    const [header] = csv.split("\r\n");
    expect(header).toBe('"Full Name","Email Address","Organization Role","Teams","country","\'=cmd"');
  });
});

describe("buildMemberCsvExport", () => {
  test("writes the template's columns and one row per member, with values joined and roles as words", () => {
    const csv = buildMemberCsvExport(
      [
        {
          name: "Anna",
          email: "anna@example.com",
          role: "dashboard_viewer",
          teams: [{ name: "Nordics" }, { name: "Support" }],
          attributes: { country: ["Sweden", "Norway"] },
        },
        { name: "Tom", email: "tom@example.com", role: "member", teams: [], attributes: {} },
      ],
      [{ key: "country", label: "Country" }]
    );
    const lines = csv.trim().split(/\r?\n/);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("country");
    expect(lines[1]).toContain("Dashboard Viewer");
    expect(lines[1]).toContain("Nordics, Support");
    expect(lines[1]).toContain("Sweden; Norway");
    expect(lines[2]).toContain("Member");
  });

  test("defangs a formula in a member's name", () => {
    const csv = buildMemberCsvExport(
      [{ name: "=cmd()", email: "x@example.com", role: "member", teams: [], attributes: {} }],
      []
    );
    expect(csv).not.toMatch(/(^|,)=cmd/m);
  });
});

describe("attribute cells", () => {
  test("split on commas, semicolons and line breaks, like the tags field", () => {
    expect(splitAttributeCell("Sweden; Norway,  Denmark\nFinland")).toEqual([
      "Sweden",
      "Norway",
      "Denmark",
      "Finland",
    ]);
    expect(splitAttributeCell(" ; ,")).toEqual([]);
  });

  test("keep a quoted value with a separator or a quote whole", () => {
    expect(splitAttributeCell('"Washington, D.C."; Oslo')).toEqual(["Washington, D.C.", "Oslo"]);
    expect(splitAttributeCell('"say ""hi""; bye"')).toEqual(['say "hi"; bye']);
  });

  test("round-trip every value through the download and the import", () => {
    const values = ["Washington, D.C.", "Oslo", 'A "quoted"; value', "Tab\there"];
    expect(splitAttributeCell(joinAttributeCell(values))).toEqual(values);
    expect(joinAttributeCell(["Sweden", "Norway"])).toBe("Sweden; Norway");
  });
});
