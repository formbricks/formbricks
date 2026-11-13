import { describe, expect, test, vi } from "vitest";
import { toWorkflowsLogger } from "./workflows-logger";

describe("toWorkflowsLogger", () => {
  test("logs an error's name and frames, never its message, whichever key the package uses", () => {
    const warn = vi.fn();
    const error = vi.fn();
    const log = toWorkflowsLogger({ warn, error });
    const thrown = new Error("Unique constraint failed on value customer@example.com");

    log.error({ error: thrown, workflowId: "wf_1" }, "Failed to record workflow secret audit");
    log.warn({ err: thrown }, "Failed to delete unreferenced workflow secrets");

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: "wf_1", errName: "Error" }),
      "Failed to record workflow secret audit"
    );
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ errName: "Error" }), expect.any(String));
    expect(JSON.stringify([error.mock.calls, warn.mock.calls])).not.toContain("customer@example.com");
  });

  test("passes other fields through untouched", () => {
    const warn = vi.fn();
    const log = toWorkflowsLogger({ warn, error: vi.fn() });

    log.warn({ statusCode: 400, invalidParams: [] }, "Workflow request validation failed");

    expect(warn).toHaveBeenCalledWith(
      { statusCode: 400, invalidParams: [] },
      "Workflow request validation failed"
    );
  });
});
