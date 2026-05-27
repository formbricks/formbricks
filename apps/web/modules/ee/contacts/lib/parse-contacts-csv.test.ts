import { describe, expect, test } from "vitest";
import { parseContactsCSV } from "./parse-contacts-csv";

describe("parseContactsCSV", () => {
  const expected = [
    { email: "user1@example.com", user_id: "1001", first_name: "John" },
    { email: "user2@example.com", user_id: "1002", first_name: "Jane" },
  ];

  test("parses comma-delimited CSV", () => {
    const csv = `email,user_id,first_name
user1@example.com,1001,John
user2@example.com,1002,Jane`;
    expect(parseContactsCSV(csv)).toEqual(expected);
  });

  test("parses semicolon-delimited CSV (EU Excel default)", () => {
    const csv = `email;user_id;first_name
user1@example.com;1001;John
user2@example.com;1002;Jane`;
    expect(parseContactsCSV(csv)).toEqual(expected);
  });

  test("parses tab-delimited CSV", () => {
    const csv = `email\tuser_id\tfirst_name
user1@example.com\t1001\tJohn
user2@example.com\t1002\tJane`;
    expect(parseContactsCSV(csv)).toEqual(expected);
  });

  test("skips empty lines", () => {
    const csv = `email,user_id,first_name

user1@example.com,1001,John

user2@example.com,1002,Jane
`;
    expect(parseContactsCSV(csv)).toEqual(expected);
  });

  test("returns empty array for header-only CSV", () => {
    expect(parseContactsCSV("email,user_id,first_name")).toEqual([]);
  });

  test("throws on malformed CSV with inconsistent column count", () => {
    const csv = `email,user_id,first_name
user1@example.com,1001`;
    expect(() => parseContactsCSV(csv)).toThrow();
  });
});
