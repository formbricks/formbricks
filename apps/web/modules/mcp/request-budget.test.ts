import { describe, expect, test } from "vitest";
import { findArrayBudgetViolation } from "@/app/api/v3/lib/array-budget";
import { MCP_REQUEST_MAX_ELEMENTS, getMcpRequestBudgetError } from "./request-budget";
import { ZMcpCreateFeedbackRecordsInput } from "./tools/schemas";

describe("MCP request input budget", () => {
  test("allows the object-member boundary and rejects one additional member", () => {
    const record = Object.fromEntries(
      Array.from({ length: MCP_REQUEST_MAX_ELEMENTS }, (_, index) => [`key${index}`, null])
    );

    expect(getMcpRequestBudgetError(record)).toBeNull();
    expect(getMcpRequestBudgetError({ ...record, extra: null })).not.toBeNull();
  });

  test("combines array entries and object members that separately fit the existing array limits", () => {
    const record = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`key${index}`, false]));
    const payload = Array.from({ length: 500 }, () => record);

    expect(findArrayBudgetViolation(payload)).toBeNull();
    expect(getMcpRequestBudgetError(payload)).not.toBeNull();
  });

  test("preserves a full feedback batch with substantial valid metadata", () => {
    const metadata = Object.fromEntries(Array.from({ length: 400 }, (_, index) => [`key${index}`, "value"]));
    const args = {
      workspaceId: "clxx1234567890123456789012",
      datasetId: "clds1234567890123456789012",
      records: Array.from({ length: 50 }, () => ({
        source_type: "survey",
        field_id: "feedback",
        field_type: "text",
        value_text: "Useful feedback",
        metadata,
      })),
    };
    expect(ZMcpCreateFeedbackRecordsInput.safeParse(args).success).toBe(true);
    expect(
      getMcpRequestBudgetError({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "create_feedback_records", arguments: args },
      })
    ).toBeNull();
  });
});
