import { auditSettings } from "./lib/__mocks__/security-action-boundaries";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { createEmailToken } from "@/lib/jwt";
import { getUserByEmail } from "@/lib/user/service";
import { createEmailTokenAction } from "./actions";

vi.mock("@/lib/jwt", () => ({ createEmailToken: vi.fn() }));
vi.mock("@/lib/user/service", () => ({ getUserByEmail: vi.fn() }));

beforeEach(() => {
  auditSettings.enabled = true;
  vi.mocked(getUserByEmail).mockResolvedValue({ id: "user-1", email: "ada@example.com" } as never);
  vi.mocked(createEmailToken).mockReturnValue("private-token");
});

describe("email token issuance entry point", () => {
  test("normalizes the email and audits issuance against the stored account without claiming an authenticated actor", async () => {
    expect(await createEmailTokenAction({ email: "Ada@Example.com" })).toEqual({ data: "private-token" });
    expect(getUserByEmail).toHaveBeenCalledWith("ada@example.com");
    expect(logger.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { id: "unknown", type: "anonymous" },
        action: "jwtTokenCreated",
        target: { type: "user", id: "user-1" },
        scope: "global",
        status: "success",
        requestId: "request-1",
      })
    );
    expect(JSON.stringify(vi.mocked(logger.audit).mock.calls)).not.toMatch(/ada@example|private-token/);
  });
  test("unknown account, validation denial and failed signing never emit success", async () => {
    vi.mocked(getUserByEmail).mockResolvedValueOnce(null);
    expect(await createEmailTokenAction({ email: "ada@example.com" })).toMatchObject({
      serverError: "Invalid request",
    });
    expect(logger.audit).toHaveBeenLastCalledWith(expect.objectContaining({ status: "denied" }));
    await createEmailTokenAction({ email: "invalid" });
    expect(logger.audit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "denied",
        changes: { operation: "email_token_issue", reason: "invalid_input" },
      })
    );
    vi.mocked(createEmailToken).mockImplementation(() => {
      throw new Error("signing failed");
    });
    await createEmailTokenAction({ email: "ada@example.com" });
    expect(logger.audit).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failure" }));
  });
  test("disabled auditing and a failing sink preserve token issuance", async () => {
    auditSettings.enabled = false;
    expect(await createEmailTokenAction({ email: "ada@example.com" })).toEqual({ data: "private-token" });
    expect(logger.audit).not.toHaveBeenCalled();
    auditSettings.enabled = true;
    vi.mocked(logger.audit).mockImplementation(() => {
      throw new Error("sink failed");
    });
    expect(await createEmailTokenAction({ email: "ada@example.com" })).toEqual({ data: "private-token" });
  });
});
