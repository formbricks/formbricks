// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FORMBRICKS_ENVIRONMENT_ID_LS, FORMBRICKS_WORKSPACE_ID_LS } from "@/lib/localStorage";
import { logSignOutAction } from "@/modules/auth/actions/sign-out";
import { useSignOut } from "@/modules/auth/hooks/use-sign-out";

// vitestSetup.ts mocks this hook globally (so component tests don't hit Better Auth); unmock here so we
// exercise the REAL implementation. logSignOutAction is globally mocked there too — reuse that spy.
vi.unmock("@/modules/auth/hooks/use-sign-out");

// Hoisted so the (hoisted) vi.mock factories below can reference them.
const { baSignOut, loggerError } = vi.hoisted(() => ({ baSignOut: vi.fn(), loggerError: vi.fn() }));
vi.mock("@/modules/auth/lib/auth-client", () => ({
  authClient: { signOut: (...args: unknown[]) => baSignOut(...args) },
}));
vi.mock("@formbricks/logger", () => ({ logger: { error: loggerError } }));

const mockedLogSignOut = vi.mocked(logSignOutAction);
// The hook reads a bare `localStorage` global, which vitest's jsdom doesn't expose on globalThis.
const localStorageMock = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };

let originalLocation: Location;

beforeEach(() => {
  originalLocation = window.location;
  // jsdom throws on real navigation, so swap in a plain object we can read href off of.
  Object.defineProperty(window, "location", { configurable: true, writable: true, value: { href: "" } });
  vi.stubGlobal("localStorage", localStorageMock);
  vi.clearAllMocks();
  baSignOut.mockResolvedValue({ error: null });
  mockedLogSignOut.mockResolvedValue(undefined);
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useSignOut", () => {
  test("audits the sign-out, calls Better Auth signOut, and redirects to /auth/login by default", async () => {
    const { signOut } = useSignOut({ id: "user-1", email: "ada@example.com" });

    await signOut({ reason: "user_initiated", organizationId: "org-1" });

    expect(mockedLogSignOut).toHaveBeenCalledWith("user-1", "ada@example.com", {
      reason: "user_initiated",
      redirectUrl: undefined,
      organizationId: "org-1",
    });
    expect(baSignOut).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe("/auth/login");
  });

  test("defaults the reason and uses callbackUrl as the audit redirectUrl + navigation target", async () => {
    const { signOut } = useSignOut({ id: "u", email: "e@x.com" });

    await signOut({ callbackUrl: "/dashboard" });

    expect(mockedLogSignOut).toHaveBeenCalledWith("u", "e@x.com", {
      reason: "user_initiated",
      redirectUrl: "/dashboard",
      organizationId: undefined,
    });
    expect(window.location.href).toBe("/dashboard");
  });

  test("returns { url } and does not navigate when redirect is false", async () => {
    const { signOut } = useSignOut({ id: "u", email: "e@x.com" });

    const result = await signOut({ redirect: false, callbackUrl: "/next" });

    expect(result).toEqual({ url: "/next" });
    expect(window.location.href).toBe(""); // no navigation occurred
  });

  test("clears the workspace + environment localStorage keys when clearWorkspaceId is set", async () => {
    const { signOut } = useSignOut({ id: "u", email: "e@x.com" });

    await signOut({ clearWorkspaceId: true });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(FORMBRICKS_WORKSPACE_ID_LS);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(FORMBRICKS_ENVIRONMENT_ID_LS);
  });

  test("skips the audit log when there is no session user", async () => {
    const { signOut } = useSignOut(null);

    await signOut();

    expect(mockedLogSignOut).not.toHaveBeenCalled();
    expect(baSignOut).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe("/auth/login");
  });

  test("still signs out and redirects when audit logging throws", async () => {
    mockedLogSignOut.mockRejectedValueOnce(new Error("audit down"));
    const { signOut } = useSignOut({ id: "u", email: "e@x.com" });

    await signOut();

    expect(loggerError).toHaveBeenCalled();
    expect(baSignOut).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe("/auth/login");
  });

  test("logs and proceeds when Better Auth signOut resolves with an error", async () => {
    baSignOut.mockResolvedValueOnce({ error: { message: "ba boom" } });
    const { signOut } = useSignOut({ id: "u", email: "e@x.com" });

    await signOut();

    expect(loggerError).toHaveBeenCalled();
    expect(window.location.href).toBe("/auth/login");
  });

  test("logs and still redirects when Better Auth signOut throws", async () => {
    baSignOut.mockRejectedValueOnce(new Error("network"));
    const { signOut } = useSignOut({ id: "u", email: "e@x.com" });

    await signOut();

    expect(loggerError).toHaveBeenCalled();
    expect(window.location.href).toBe("/auth/login");
  });
});
