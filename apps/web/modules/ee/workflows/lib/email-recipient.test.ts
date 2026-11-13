import { describe, expect, test } from "vitest";
import {
  fromRecipientSelectValue,
  getRecipientVariableOptions,
  toRecipientSelectValue,
} from "./email-recipient";

describe("recipient select value", () => {
  test("keeps a literal or survey-field recipient as it is", () => {
    expect(toRecipientSelectValue("jane@example.com")).toBe("jane@example.com");
    expect(fromRecipientSelectValue("jane@example.com")).toBe("jane@example.com");
  });

  test("round-trips a Variable recipient", () => {
    const to = { type: "variable" as const, ref: "payload.customer.email" };
    expect(toRecipientSelectValue(to)).toBe("variable:payload.customer.email");
    expect(fromRecipientSelectValue(toRecipientSelectValue(to))).toEqual(to);
  });
});

describe("getRecipientVariableOptions", () => {
  const groups = [
    {
      kind: "payload" as const,
      hasSample: true,
      truncated: false,
      options: [
        {
          path: "payload.customer.email",
          label: "customer.email",
          typeHint: "text" as const,
          isPickable: true,
        },
        {
          path: "payload.handle_time_sec",
          label: "handle_time_sec",
          typeHint: "number" as const,
          isPickable: true,
        },
        { path: "payload.emails", label: "emails", typeHint: "list" as const, isPickable: false },
      ],
    },
    {
      kind: "response" as const,
      options: [{ path: "response.q1", label: "Q1", typeHint: "text" as const, isPickable: true }],
    },
  ];

  test("offers the text Variables of the payload", () => {
    expect(getRecipientVariableOptions(groups, "")).toEqual([
      { value: "variable:payload.customer.email", label: "@customer.email" },
    ]);
  });

  test("keeps the current Variable listed when the sample no longer has it", () => {
    expect(getRecipientVariableOptions(groups, { type: "variable", ref: "payload.contact.email" })).toEqual([
      { value: "variable:payload.customer.email", label: "@customer.email" },
      { value: "variable:payload.contact.email", label: "@contact.email" },
    ]);
  });
});
