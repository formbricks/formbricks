import { describe, expect, test } from "vitest";
import { isLiteralEmailRecipient } from "./recipients";

describe("isLiteralEmailRecipient", () => {
  test("treats a valid email address as a literal recipient", () => {
    expect(isLiteralEmailRecipient("member@corp.example")).toBe(true);
    expect(isLiteralEmailRecipient("A.User+tag@Corp.Example")).toBe(true);
  });

  test("treats a survey element id (not an email) as a respondent-field recipient", () => {
    expect(isLiteralEmailRecipient("email-question-id")).toBe(false);
    expect(isLiteralEmailRecipient("contact")).toBe(false);
    expect(isLiteralEmailRecipient("")).toBe(false);
  });
});
