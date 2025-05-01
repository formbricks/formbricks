import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { checkSpamProtectionPermission } from "./permission";

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsSpamProtectionEnabled: vi.fn(),
}));

describe("checkSpamProtectionPermission", () => {
  afterEach(() => {
    cleanup();
  });

  test("resolves if spam protection is enabled", async () => {
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(true);
    await expect(checkSpamProtectionPermission()).resolves.toBeUndefined();
  });

  test("throws OperationNotAllowedError if spam protection is not enabled", async () => {
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(false);
    await expect(checkSpamProtectionPermission()).rejects.toThrow(OperationNotAllowedError);
    await expect(checkSpamProtectionPermission()).rejects.toThrow(
      "Spam protection is not enabled for this organization"
    );
  });
});
