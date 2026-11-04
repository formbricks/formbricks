import { describe, expect, test, vi } from "vitest";
import type { TResponse } from "@formbricks/types/responses";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_AUDIT_REQUEST_METADATA } from "@/modules/ee/audit-logs/lib/request-metadata";
import { auditLowQualityMark } from "./mark-low-quality";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/responses/lib/outcome-write", () => ({ writeResponsesOutcomeInTx: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: vi.fn(async () => undefined) }));

const response = { id: "response00000000000000001" } as TResponse;

describe("auditLowQualityMark", () => {
  test("files the mark without the respondent's IP or user agent", async () => {
    await auditLowQualityMark({ response, organizationId: "org00000000000000000001" });

    expect(queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: response.id,
        userType: "system",
        // Read from the request otherwise: the respondent's headers, which the audit log never holds.
        requestMetadata: UNKNOWN_AUDIT_REQUEST_METADATA,
      })
    );
  });

  test("files nothing when the mark changed nothing", async () => {
    vi.mocked(queueAuditEvent).mockClear();
    await auditLowQualityMark({ response });

    expect(queueAuditEvent).not.toHaveBeenCalled();
  });
});
