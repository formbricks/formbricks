import { beforeEach, describe, expect, test, vi } from "vitest";
import { putInternalEmbeddedFieldLabel } from "./operations";

const { mockRequireAccess, mockSetLabel } = vi.hoisted(() => ({
  mockRequireAccess: vi.fn(),
  mockSetLabel: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/dashboards-access", () => ({ requireDashboardsAccess: mockRequireAccess }));
vi.mock("@/modules/ee/analysis/lib/embedded-field-labels", () => ({ setEmbeddedFieldLabel: mockSetLabel }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}));

const workspaceId = "clws111111111111111111111";
const context = {
  authentication: { user: { id: "user_1" } } as never,
  requestId: "req-1",
  instance: "/api/internal/embedded-field-labels",
};
const put = (label: string, auditLog?: Record<string, unknown>) =>
  putInternalEmbeddedFieldLabel({
    ...context,
    body: { workspaceId, key: "plan", label, expectedLabel: null },
    auditLog: auditLog as never,
  });

describe("putInternalEmbeddedFieldLabel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAccess.mockResolvedValue({ workspaceId, organizationId: "org-1" });
  });

  test("needs read & write on the workspace, and writes nothing without it", async () => {
    mockRequireAccess.mockResolvedValueOnce(new Response(null, { status: 403 }));

    expect((await put("Subscription plan")).status).toBe(403);
    expect(mockRequireAccess).toHaveBeenCalledWith(
      context.authentication,
      workspaceId,
      "readWrite",
      "req-1",
      context.instance
    );
    expect(mockSetLabel).not.toHaveBeenCalled();
  });

  test("saves the trimmed name in the authorized workspace and audits the change", async () => {
    const current = { id: "row-1", key: "plan", label: "Subscription plan" };
    mockSetLabel.mockResolvedValue({ kind: "saved", previous: null, current });
    const auditLog: Record<string, unknown> = {};

    const response = await put("  Subscription plan ", auditLog);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { key: "plan", label: "Subscription plan" } });
    expect(mockSetLabel).toHaveBeenCalledWith({
      workspaceId,
      key: "plan",
      label: "Subscription plan",
      expectedLabel: null,
    });
    expect(auditLog).toMatchObject({ targetId: "row-1", organizationId: "org-1", newObject: current });
  });

  test("an empty name clears the override", async () => {
    mockSetLabel.mockResolvedValue({ kind: "saved", previous: null, current: null });

    const response = await put("");

    expect(mockSetLabel).toHaveBeenCalledWith({ workspaceId, key: "plan", label: null, expectedLabel: null });
    expect(await response.json()).toMatchObject({ data: { key: "plan", label: null } });
  });

  test("answers 422 naming the cap when the workspace has renamed too many fields", async () => {
    mockSetLabel.mockResolvedValue({ kind: "limitReached" });

    const response = await put("Subscription plan");

    expect(response.status).toBe(422);
    expect(JSON.stringify(await response.json())).toContain("at most 1000");
  });

  test("answers 409 and writes nothing when the name changed since the editor read it", async () => {
    mockSetLabel.mockResolvedValue({ kind: "stale", current: { id: "row-1", key: "plan", label: "Tier" } });
    const response = await put("Subscription plan");
    expect(response.status).toBe(409);
  });
});
