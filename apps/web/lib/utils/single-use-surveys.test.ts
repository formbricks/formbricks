import * as crypto from "@/lib/crypto";
import { env } from "@/lib/env";
import cuid2 from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateSurveySingleUseId, generateSurveySingleUseIds } from "./single-use-surveys";

vi.mock("@/lib/crypto", () => ({
  symmetricEncrypt: vi.fn(),
  symmetricDecrypt: vi.fn(),
}));

vi.mock(
  "@paralleldrive/cuid2",
  async (importOriginal: () => Promise<typeof import("@paralleldrive/cuid2")>) => {
    const original = await importOriginal();
    return {
      ...original,
      createId: vi.fn(),
      isCuid: vi.fn(),
    };
  }
);

vi.mock("@/lib/env", () => ({
  env: {
    ENCRYPTION_KEY: "test-encryption-key",
  },
}));

describe("Single Use Surveys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateSurveySingleUseId", () => {
    test("returns plain cuid when encryption is disabled", () => {
      const createIdMock = vi.spyOn(cuid2, "createId");
      createIdMock.mockReturnValueOnce("test-cuid");

      const result = generateSurveySingleUseId(false);

      expect(result).toBe("test-cuid");
      expect(createIdMock).toHaveBeenCalledTimes(1);
      expect(crypto.symmetricEncrypt).not.toHaveBeenCalled();
    });

    test("returns encrypted cuid when encryption is enabled", () => {
      const createIdMock = vi.spyOn(cuid2, "createId");
      createIdMock.mockReturnValueOnce("test-cuid");
      vi.mocked(crypto.symmetricEncrypt).mockReturnValueOnce("encrypted-test-cuid");

      const result = generateSurveySingleUseId(true);

      expect(result).toBe("encrypted-test-cuid");
      expect(createIdMock).toHaveBeenCalledTimes(1);
      expect(crypto.symmetricEncrypt).toHaveBeenCalledWith("test-cuid", env.ENCRYPTION_KEY);
    });

    test("throws error when encryption key is missing", () => {
      vi.mocked(env).ENCRYPTION_KEY = "";
      const createIdMock = vi.spyOn(cuid2, "createId");
      createIdMock.mockReturnValueOnce("test-cuid");

      expect(() => generateSurveySingleUseId(true)).toThrow("ENCRYPTION_KEY is not set");

      // Restore encryption key for subsequent tests
      vi.mocked(env).ENCRYPTION_KEY = "test-encryption-key";
    });
  });

  describe("generateSurveySingleUseIds", () => {
    beforeEach(() => {
      vi.mocked(env).ENCRYPTION_KEY = "test-encryption-key";
    });

    test("generates multiple single use IDs", () => {
      const createIdMock = vi.spyOn(cuid2, "createId");
      createIdMock
        .mockReturnValueOnce("test-cuid-1")
        .mockReturnValueOnce("test-cuid-2")
        .mockReturnValueOnce("test-cuid-3");

      const result = generateSurveySingleUseIds(3, false);

      expect(result).toEqual(["test-cuid-1", "test-cuid-2", "test-cuid-3"]);
      expect(createIdMock).toHaveBeenCalledTimes(3);
    });

    test("generates encrypted IDs when encryption is enabled", () => {
      const createIdMock = vi.spyOn(cuid2, "createId");

      createIdMock.mockReturnValueOnce("test-cuid-1").mockReturnValueOnce("test-cuid-2");

      vi.mocked(crypto.symmetricEncrypt)
        .mockReturnValueOnce("encrypted-test-cuid-1")
        .mockReturnValueOnce("encrypted-test-cuid-2");

      const result = generateSurveySingleUseIds(2, true);

      expect(result).toEqual(["encrypted-test-cuid-1", "encrypted-test-cuid-2"]);
      expect(createIdMock).toHaveBeenCalledTimes(2);
      expect(crypto.symmetricEncrypt).toHaveBeenCalledTimes(2);
    });

    test("returns empty array when count is zero", () => {
      const result = generateSurveySingleUseIds(0, false);

      const createIdMock = vi.spyOn(cuid2, "createId");
      createIdMock.mockReturnValueOnce("test-cuid");

      expect(result).toEqual([]);
      expect(createIdMock).not.toHaveBeenCalled();
    });
  });
});
