import cuid2 from "@paralleldrive/cuid2";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as crypto from "@formbricks/lib/crypto";
import { generateSurveySingleUseId, validateSurveySingleUseId } from "./singleUseSurveys";

// Mock the crypto module
vi.mock("@formbricks/lib/crypto", () => ({
  symmetricEncrypt: vi.fn(),
  symmetricDecrypt: vi.fn(),
  decryptAES128: vi.fn(),
}));

// Mock constants
vi.mock("@formbricks/lib/constants", () => ({
  ENCRYPTION_KEY: "test-encryption-key",
  FORMBRICKS_ENCRYPTION_KEY: "test-formbricks-encryption-key",
}));

// Mock cuid2
vi.mock("@paralleldrive/cuid2", () => {
  const createIdMock = vi.fn();
  const isCuidMock = vi.fn();

  return {
    default: {
      createId: createIdMock,
      isCuid: isCuidMock,
    },
    createId: createIdMock,
    isCuid: isCuidMock,
  };
});

describe("generateSurveySingleUseId", () => {
  const mockCuid = "test-cuid-123";
  const mockEncryptedCuid = "encrypted-cuid-123";

  beforeEach(() => {
    // Setup mocks
    vi.mocked(cuid2.createId).mockReturnValue(mockCuid);
    vi.mocked(crypto.symmetricEncrypt).mockReturnValue(mockEncryptedCuid);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("returns unencrypted cuid when isEncrypted is false", () => {
    const result = generateSurveySingleUseId(false);

    expect(result).toBe(mockCuid);
    expect(crypto.symmetricEncrypt).not.toHaveBeenCalled();
  });

  test("returns encrypted cuid when isEncrypted is true", () => {
    const result = generateSurveySingleUseId(true);

    expect(result).toBe(mockEncryptedCuid);
    expect(crypto.symmetricEncrypt).toHaveBeenCalledWith(mockCuid, "test-encryption-key");
  });

  test("returns undefined when cuid is not valid", () => {
    vi.mocked(cuid2.isCuid).mockReturnValue(false);

    const result = validateSurveySingleUseId(mockEncryptedCuid);

    expect(result).toBeUndefined();
  });

  test("returns undefined when decryption fails", () => {
    vi.mocked(crypto.symmetricDecrypt).mockImplementation(() => {
      throw new Error("Decryption failed");
    });

    const result = validateSurveySingleUseId(mockEncryptedCuid);

    expect(result).toBeUndefined();
  });

  test("throws error when ENCRYPTION_KEY is not set in generateSurveySingleUseId", async () => {
    // Temporarily mock ENCRYPTION_KEY as undefined
    vi.doMock("@formbricks/lib/constants", () => ({
      ENCRYPTION_KEY: undefined,
      FORMBRICKS_ENCRYPTION_KEY: "test-formbricks-encryption-key",
    }));

    // Re-import to get the new mock values
    const { generateSurveySingleUseId: generateSurveySingleUseIdNoKey } = await import("./singleUseSurveys");

    expect(() => generateSurveySingleUseIdNoKey(true)).toThrow("ENCRYPTION_KEY is not set");
  });

  test("throws error when ENCRYPTION_KEY is not set in validateSurveySingleUseId for symmetric encryption", async () => {
    // Temporarily mock ENCRYPTION_KEY as undefined
    vi.doMock("@formbricks/lib/constants", () => ({
      ENCRYPTION_KEY: undefined,
      FORMBRICKS_ENCRYPTION_KEY: "test-formbricks-encryption-key",
    }));

    // Re-import to get the new mock values
    const { validateSurveySingleUseId: validateSurveySingleUseIdNoKey } = await import("./singleUseSurveys");

    expect(() => validateSurveySingleUseIdNoKey(mockEncryptedCuid)).toThrow("ENCRYPTION_KEY is not set");
  });

  test("throws error when FORMBRICKS_ENCRYPTION_KEY is not set in validateSurveySingleUseId for AES128", async () => {
    // Temporarily mock FORMBRICKS_ENCRYPTION_KEY as undefined
    vi.doMock("@formbricks/lib/constants", () => ({
      ENCRYPTION_KEY: "test-encryption-key",
      FORMBRICKS_ENCRYPTION_KEY: undefined,
    }));

    // Re-import to get the new mock values
    const { validateSurveySingleUseId: validateSurveySingleUseIdNoKey } = await import("./singleUseSurveys");

    expect(() =>
      validateSurveySingleUseIdNoKey("M(.Bob=dS1!wUSH2lb,E7hxO=He1cnnitmXrG|Su/DKYZrPy~zgS)u?dgI53sfs/")
    ).toThrow("FORMBRICKS_ENCRYPTION_KEY is not defined");
  });
});
