import { describe, expect, test, vi } from "vitest";
import { InvalidInputError, ValidationError } from "@formbricks/types/errors";
import {
  formatInviteFailureMessage,
  formatInviteFailureMessages,
  getInviteFailureReason,
  getInviteFailureReasonFromMessage,
} from "./invite-failure";

describe("getInviteFailureReason", () => {
  test("maps invite already exists", () => {
    expect(getInviteFailureReason(new InvalidInputError("Invite already exists"))).toBe(
      "invite_already_exists"
    );
  });

  test("maps user already member", () => {
    expect(
      getInviteFailureReason(new InvalidInputError("User is already a member of this organization"))
    ).toBe("user_already_member");
  });

  test("maps duplicate team ids", () => {
    expect(getInviteFailureReason(new ValidationError("teamIds must be unique"))).toBe("duplicate_team_ids");
  });

  test("maps invalid team ids", () => {
    expect(getInviteFailureReason(new ValidationError("Invalid teamIds"))).toBe("invalid_team_ids");
  });

  test("returns unknown for unrecognized errors", () => {
    expect(getInviteFailureReason(new Error("Something else"))).toBe("unknown");
  });
});

describe("getInviteFailureReasonFromMessage", () => {
  test("maps known server error messages", () => {
    expect(getInviteFailureReasonFromMessage("Invite already exists")).toBe("invite_already_exists");
  });

  test("returns unknown for unrecognized messages", () => {
    expect(getInviteFailureReasonFromMessage("Unexpected error")).toBe("unknown");
  });
});

describe("formatInviteFailureMessage", () => {
  const t = vi.fn((key: string, params?: { email?: string }) => `${key}:${params?.email ?? ""}`);

  test("uses reason-specific translation key", () => {
    expect(
      formatInviteFailureMessage(t, { email: "a@example.com", failureReason: "invite_already_exists" })
    ).toBe("workspace.settings.general.invite_failure_invite_exists:a@example.com");
  });
});

describe("formatInviteFailureMessages", () => {
  const t = vi.fn((key: string, params?: { email?: string; count?: number }) => {
    if (params?.count !== undefined) {
      return `${key}:${params.count}`;
    }
    return `${key}:${params?.email ?? ""}`;
  });

  test("joins multiple failure lines", () => {
    const message = formatInviteFailureMessages(t, [
      { email: "a@example.com", failureReason: "invite_already_exists" },
      { email: "b@example.com", failureReason: "user_already_member" },
    ]);

    expect(message).toContain("invite_failure_invite_exists:a@example.com");
    expect(message).toContain("invite_failure_already_member:b@example.com");
  });

  test("truncates long failure lists", () => {
    const failures = Array.from({ length: 7 }, (_, index) => ({
      email: `user${index}@example.com`,
      failureReason: "unknown" as const,
    }));

    const message = formatInviteFailureMessages(t, failures);
    expect(message.split("\n")).toHaveLength(6);
    expect(message).toContain("invite_failures_more:2");
  });
});
