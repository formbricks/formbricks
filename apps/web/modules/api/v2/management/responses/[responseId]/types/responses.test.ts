import { describe, expect, test } from "vitest";
import { ZResponseUpdateSchema } from "./responses";

// A PUT body as every client wrote it before ENG-6780 added `outcome`: all required fields, no verdict.
const legacyBody = {
  createdAt: new Date("2021-01-01T00:00:00.000Z"),
  updatedAt: new Date("2021-01-03T00:00:00.000Z"),
  finished: false,
  language: "fr",
  endingId: null,
  contactId: null,
  contactAttributes: null,
  singleUseId: null,
  displayId: null,
  data: { question1: "updatedAnswer1" },
  variables: { variable1: "updatedAnswer1" },
  ttc: { question1: 30 },
  meta: { source: "https://updatedexample.com" },
};

describe("ZResponseUpdateSchema", () => {
  test("accepts a body written before responses carried an outcome", () => {
    expect(ZResponseUpdateSchema.safeParse(legacyBody).success).toBe(true);
  });

  test("never carries an outcome into the write, so a replayed body cannot clear a verdict", () => {
    const parsed = ZResponseUpdateSchema.safeParse({ ...legacyBody, outcome: null });

    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty("outcome");
  });
});
