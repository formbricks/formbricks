import cuid2 from "@paralleldrive/cuid2";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("returns unencrypted cuid when isEncrypted is false", () => {
    const result = generateSurveySingleUseId(false);

    expect(cuid2.createId).toHaveBeenCalledTimes(1);
    expect(crypto.symmetricEncrypt).not.toHaveBeenCalled();
    expect(result).toBe(mockCuid);
  });

  it("returns encrypted cuid when isEncrypted is true", () => {
    const result = generateSurveySingleUseId(true);

    expect(cuid2.createId).toHaveBeenCalledTimes(1);
    expect(crypto.symmetricEncrypt).toHaveBeenCalledWith(mockCuid, "test-encryption-key");
    expect(result).toBe(mockEncryptedCuid);
  });
});

describe("validateSurveySingleUseId", () => {
  const mockDecryptedCuid = "decrypted-cuid-123";
  const mockEncryptedCuid = "encrypted:cuid:123";
  const mockEncryptedCuidAES128 = "a".repeat(64); // 64 character string for AES128

  beforeEach(() => {
    // Setup mocks
    vi.mocked(crypto.symmetricDecrypt).mockReturnValue(mockDecryptedCuid);
    vi.mocked(crypto.decryptAES128).mockReturnValue(mockDecryptedCuid);
    vi.mocked(cuid2.isCuid).mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("validates and returns decrypted cuid for symmetric encryption", () => {
    const result = validateSurveySingleUseId(mockEncryptedCuid);

    expect(crypto.symmetricDecrypt).toHaveBeenCalledWith(mockEncryptedCuid, "test-encryption-key");
    expect(crypto.decryptAES128).not.toHaveBeenCalled();
    expect(cuid2.isCuid).toHaveBeenCalledWith(mockDecryptedCuid);
    expect(result).toBe(mockDecryptedCuid);
  });

  it("validates and returns decrypted cuid for AES128 encryption", () => {
    const result = validateSurveySingleUseId(mockEncryptedCuidAES128);

    expect(crypto.symmetricDecrypt).not.toHaveBeenCalled();
    expect(crypto.decryptAES128).toHaveBeenCalledWith(
      "test-formbricks-encryption-key",
      mockEncryptedCuidAES128
    );
    expect(cuid2.isCuid).toHaveBeenCalledWith(mockDecryptedCuid);
    expect(result).toBe(mockDecryptedCuid);
  });

  it("returns undefined when cuid is not valid", () => {
    vi.mocked(cuid2.isCuid).mockReturnValue(false);

    const result = validateSurveySingleUseId(mockEncryptedCuid);

    expect(result).toBeUndefined();
  });

  it("returns undefined when decryption fails", () => {
    vi.mocked(crypto.symmetricDecrypt).mockImplementation(() => {
      throw new Error("Decryption failed");
    });

    const result = validateSurveySingleUseId(mockEncryptedCuid);

    expect(result).toBeUndefined();
  });
});
