import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { logSignOut } from "@/modules/auth/lib/utils";
import { logSignOutAction } from "./sign-out";

const { sessionUser } = vi.hoisted(() => ({ sessionUser: { id: "user123", email: "test@example.com" } }));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/modules/auth/lib/utils", () => ({
  logSignOut: vi.fn(),
}));

// Runs the handler the way next-safe-action does: parse the input with the action's schema, then hand
// the authenticated user over in ctx.
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: (schema: z.ZodType) => ({
      action:
        (fn: (args: { ctx: unknown; parsedInput: unknown }) => Promise<unknown>) => async (input: unknown) =>
          fn({ ctx: { user: sessionUser }, parsedInput: schema.parse(input) }),
    }),
  },
}));

// Clear the existing mock from vitestSetup.ts
vi.unmock("@/modules/auth/actions/sign-out");

const callAction = (input: unknown) =>
  (logSignOutAction as unknown as (input: unknown) => Promise<unknown>)(input);

describe("logSignOutAction", () => {
  const mockContext = {
    reason: "user_initiated" as const,
    redirectUrl: "https://example.com",
    organizationId: "clxyz1234567890abcdefghij",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("logs the sign-out for the session user", async () => {
    await callAction(mockContext);

    expect(logSignOut).toHaveBeenCalledWith(sessionUser.id, sessionUser.email, mockContext);
    expect(logSignOut).toHaveBeenCalledTimes(1);
  });

  test("logs the session user regardless of extra input fields", async () => {
    await callAction({ ...mockContext, userId: "victim", userEmail: "victim@example.com" });

    expect(logSignOut).toHaveBeenCalledWith(sessionUser.id, sessionUser.email, mockContext);
  });

  test("rejects an unknown reason", async () => {
    await expect(callAction({ reason: "anything" })).rejects.toThrow();
    expect(logSignOut).not.toHaveBeenCalled();
  });

  test("logs error and re-throws when logSignOut throws", async () => {
    const mockError = new Error("Failed to log sign out");
    vi.mocked(logSignOut).mockImplementation(() => {
      throw mockError;
    });

    await expect(callAction(mockContext)).rejects.toThrow(mockError);

    expect(logger.error).toHaveBeenCalledWith(
      {
        userId: sessionUser.id,
        context: mockContext,
        error: mockError.message,
      },
      "Failed to log sign out event"
    );
  });
});
