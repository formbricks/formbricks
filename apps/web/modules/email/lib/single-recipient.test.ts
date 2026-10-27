import { describe, expect, test } from "vitest";
import { isSingleRecipient } from "./single-recipient";

describe("isSingleRecipient", () => {
  // nodemailer reads `to` as an address list: one invite must not reach several inboxes (ENG-6658).
  test.each([
    "a@example.com, b@example.com",
    "a@example.com; b@example.com",
    '"Bob" <b@example.com>',
    "group: a@example.com, b@example.com;",
    "<a@example.com>",
    "a@b@example.com",
    `${"a".repeat(320)}@example.com`,
    "not-an-address",
    "",
  ])("refuses %j", (to) => {
    expect(isSingleRecipient(to)).toBe(false);
  });

  // nodemailer delivers these to one inbox; refusing them (as an input comparison would) blocks valid mail.
  test.each(['"a b"@example.com', '"a@b"@example.com', "a@example.com,", "josé@bücher.example"])(
    "accepts one address the parser normalizes: %j",
    (to) => {
      expect(isSingleRecipient(to)).toBe(true);
    }
  );
});
