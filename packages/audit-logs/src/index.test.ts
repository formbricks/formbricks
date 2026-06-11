import { describe, expect, test } from "vitest";
import {
  ZAuditLogEvent,
  ZWorkflowAuditLogEvent,
  isWorkflowAuditAction,
  isWorkflowAuditTarget,
} from "./index";

const workflowAuditEvent = {
  actor: {
    id: "cm9zr4mps000008l8btfy1vtz",
    type: "user" as const,
  },
  action: "versionPublished" as const,
  target: {
    id: "cm9zr4q7i000108l84gozfggr",
    type: "workflowVersion" as const,
  },
  status: "success" as const,
  organizationId: "cm9zr4wz6000208l8by95cvsr",
  timestamp: "2026-06-08T10:00:00.000Z",
};

describe("@formbricks/audit-logs", () => {
  test("validates workflow audit events", () => {
    expect(ZWorkflowAuditLogEvent.parse(workflowAuditEvent).action).toBe("versionPublished");
    expect(
      ZWorkflowAuditLogEvent.parse({
        ...workflowAuditEvent,
        action: "archived",
        target: { ...workflowAuditEvent.target, type: "workflow" },
      }).action
    ).toBe("archived");
    expect(
      ZWorkflowAuditLogEvent.parse({
        ...workflowAuditEvent,
        action: "runFailed",
        target: { ...workflowAuditEvent.target, type: "workflowRun" },
      }).action
    ).toBe("runFailed");
  });

  test("rejects unknown workflow audit targets and actions", () => {
    expect(() =>
      ZWorkflowAuditLogEvent.parse({
        ...workflowAuditEvent,
        target: { ...workflowAuditEvent.target, type: "survey" },
      })
    ).toThrow();

    expect(() =>
      ZWorkflowAuditLogEvent.parse({
        ...workflowAuditEvent,
        action: "deleted",
      })
    ).toThrow();
  });

  test("rejects workflow audit actions on the wrong workflow target", () => {
    expect(() =>
      ZWorkflowAuditLogEvent.parse({
        ...workflowAuditEvent,
        target: { ...workflowAuditEvent.target, type: "workflow" },
      })
    ).toThrow();

    expect(() =>
      ZWorkflowAuditLogEvent.parse({
        ...workflowAuditEvent,
        action: "runFailed",
        target: { ...workflowAuditEvent.target, type: "workflowVersion" },
      })
    ).toThrow();
  });

  test("can represent the existing shared app audit event shape", () => {
    expect(
      ZAuditLogEvent.parse({
        ...workflowAuditEvent,
        action: "updated",
        target: {
          id: workflowAuditEvent.target.id,
          type: "survey",
        },
      }).target.type
    ).toBe("survey");
  });

  test("exposes workflow scope predicates", () => {
    expect(isWorkflowAuditTarget("workflowRun")).toBe(true);
    expect(isWorkflowAuditTarget("survey")).toBe(false);
    expect(isWorkflowAuditAction("dryRunCreated")).toBe(true);
    expect(isWorkflowAuditAction("deleted")).toBe(false);
  });
});
