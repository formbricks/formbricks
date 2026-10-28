import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireAuditReadAccess } from "./access";
import { listV3AuditEventsFromInput } from "./operations";
import { listAuditEventRows } from "./repository";

vi.mock("server-only", () => ({}));
vi.mock("./access", () => ({ requireAuditReadAccess: vi.fn() }));
vi.mock("./repository", () => ({ listAuditEventRows: vi.fn() }));

const organizationId = "clorg11111111111111111111";
const base = { authentication: null, requestId: "req_1", instance: "/api/mcp" };

beforeEach(() => {
  vi.mocked(requireAuditReadAccess).mockResolvedValue({ organizationId });
  vi.mocked(listAuditEventRows).mockResolvedValue([]);
});

describe("listV3AuditEventsFromInput", () => {
  test("answers 400 with the offending parameter, before any access check or read", async () => {
    const response = await listV3AuditEventsFromInput({
      ...base,
      input: { organizationId, targetId: "survey_1" },
    });

    expect(response.status).toBe(400);
    expect((await response.json()).invalid_params).toEqual([expect.objectContaining({ name: "targetType" })]);
    expect(requireAuditReadAccess).not.toHaveBeenCalled();
    expect(listAuditEventRows).not.toHaveBeenCalled();
  });

  test("reads the organization the access check returned, not a second copy of the input", async () => {
    const authorized = "clorg22222222222222222222";
    vi.mocked(requireAuditReadAccess).mockResolvedValue({ organizationId: authorized });

    const response = await listV3AuditEventsFromInput({ ...base, input: { organizationId, limit: 5 } });

    expect(response.status).toBe(200);
    expect(listAuditEventRows).toHaveBeenCalledWith({
      organizationId: authorized,
      query: expect.objectContaining({ limit: 5 }),
    });
  });

  test("returns the access refusal untouched", async () => {
    vi.mocked(requireAuditReadAccess).mockResolvedValue(new Response(null, { status: 403 }));

    const response = await listV3AuditEventsFromInput({ ...base, input: { organizationId } });

    expect(response.status).toBe(403);
    expect(listAuditEventRows).not.toHaveBeenCalled();
  });
});
