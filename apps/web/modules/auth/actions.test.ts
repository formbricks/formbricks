import { beforeEach, describe, expect, test, vi } from "vitest";
import { createEmailToken } from "@/lib/jwt";
import { getUserByEmail } from "@/lib/user/service";
import { createEmailTokenAction } from "./actions";

vi.mock("@/lib/jwt", () => ({
  createEmailToken: vi.fn(),
}));

vi.mock("@/lib/user/service", () => ({
  getUserByEmail: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  actionClient: {
    inputSchema: vi.fn().mockReturnThis(),
    action: vi.fn((fn) => fn),
  },
}));

describe("createEmailTokenAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("normalizes mixed-case email lookup and mints a token for the stored email", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue({ email: "ada@example.com" } as never);
    vi.mocked(createEmailToken).mockReturnValue("email-token");

    const result = await createEmailTokenAction({
      parsedInput: { email: "Ada@Example.com" },
    } as never);

    expect(getUserByEmail).toHaveBeenCalledWith("ada@example.com");
    expect(createEmailToken).toHaveBeenCalledWith("ada@example.com");
    expect(result).toBe("email-token");
  });

  test("rejects token creation when no matching user exists", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null);

    await expect(
      createEmailTokenAction({
        parsedInput: { email: "Ada@Example.com" },
      } as never)
    ).rejects.toThrow("Invalid request");
    expect(createEmailToken).not.toHaveBeenCalled();
  });
});
