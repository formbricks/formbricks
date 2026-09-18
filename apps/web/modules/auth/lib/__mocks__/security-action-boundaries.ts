import { vi } from "vitest";

vi.unmock("crypto");
vi.unmock("node:crypto");

const auditSettings = vi.hoisted(() => ({ enabled: true }));
vi.mock("@/lib/constants", () => ({
  get AUDIT_LOG_ENABLED() {
    return auditSettings.enabled;
  },
  WEBAPP_URL: "http://localhost:3000",
}));
vi.mock("@formbricks/logger", () => ({ logger: { audit: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/utils/action-client", async () => {
  const { createSafeActionClient } = await import("next-safe-action");
  return {
    actionClient: createSafeActionClient({ handleServerError: (error) => error.message }).use(
      async ({ next }) => next({ ctx: { auditLoggingCtx: { eventId: "request-1" } } })
    ),
  };
});
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyIPRateLimit: vi.fn() }));

export { auditSettings };
