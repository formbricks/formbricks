import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TResponse } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { TSurvey } from "@formbricks/types/surveys/types";
import { ENCRYPTION_KEY } from "@/lib/constants";
import * as crypto from "@/lib/crypto";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getResponse } from "@/lib/response/service";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import * as prefillSurveyLink from "./prefill-survey-link";

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
    TokenExpiredError: class TokenExpiredError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "TokenExpiredError";
      }
    },
  },
}));

vi.mock("@/lib/constants", () => ({
  ENCRYPTION_KEY: "test-encryption-key-32-chars-long!",
}));

vi.mock("@/lib/getPublicUrl", () => ({
  getPublicDomain: vi.fn().mockReturnValue("https://test.formbricks.com"),
}));

vi.mock("@/lib/crypto", () => ({
  symmetricEncrypt: vi.fn(),
  symmetricDecrypt: vi.fn(),
}));

vi.mock("@/lib/response/service", () => ({
  getResponse: vi.fn(),
}));

vi.mock("@/modules/survey/lib/client-utils", () => ({
  getElementsFromBlocks: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("Prefill Survey Link", () => {
  const mockResponseId = "response-789";
  const mockSurveyId = "survey-456";
  const mockToken = "mock.jwt.token";
  const mockEncryptedResponseId = "encrypted-response-id";
  const mockEncryptedSurveyId = "encrypted-survey-id";

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getPublicDomain).mockReturnValue("https://test.formbricks.com");

    vi.mocked(crypto.symmetricEncrypt).mockImplementation((value) =>
      value === mockResponseId ? mockEncryptedResponseId : mockEncryptedSurveyId
    );

    vi.mocked(crypto.symmetricDecrypt).mockImplementation((value) => {
      if (value === mockEncryptedResponseId) return mockResponseId;
      if (value === mockEncryptedSurveyId) return mockSurveyId;
      return value;
    });

    vi.mocked(jwt.sign).mockReturnValue(mockToken as any);

    vi.mocked(jwt.verify).mockReturnValue({
      responseId: mockEncryptedResponseId,
      surveyId: mockEncryptedSurveyId,
    } as any);
  });

  describe("getPrefillSurveyLink", () => {
    test("creates a prefill link with encrypted response and survey IDs", () => {
      const result = prefillSurveyLink.getPrefillSurveyLink(mockResponseId, mockSurveyId);

      expect(crypto.symmetricEncrypt).toHaveBeenCalledWith(mockResponseId, ENCRYPTION_KEY);
      expect(crypto.symmetricEncrypt).toHaveBeenCalledWith(mockSurveyId, ENCRYPTION_KEY);

      // Default expiration is applied
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          responseId: mockEncryptedResponseId,
          surveyId: mockEncryptedSurveyId,
        },
        ENCRYPTION_KEY,
        { algorithm: "HS256", expiresIn: "7d" }
      );

      expect(result).toEqual({
        ok: true,
        data: `${getPublicDomain()}/s/${mockSurveyId}?prefillToken=${mockToken}`,
      });
    });

    test("applies a custom expiration when provided", () => {
      prefillSurveyLink.getPrefillSurveyLink(mockResponseId, mockSurveyId, 2);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          responseId: mockEncryptedResponseId,
          surveyId: mockEncryptedSurveyId,
        },
        ENCRYPTION_KEY,
        { algorithm: "HS256", expiresIn: "2d" }
      );
    });

    test("returns an error when ENCRYPTION_KEY is not available", async () => {
      vi.resetModules();
      vi.doMock("@/lib/constants", () => ({ ENCRYPTION_KEY: undefined }));
      const { getPrefillSurveyLink } = await import("./prefill-survey-link");

      const result = getPrefillSurveyLink(mockResponseId, mockSurveyId);
      expect(result).toEqual({
        ok: false,
        error: {
          type: "internal_server_error",
          message: "Encryption key not found - cannot create prefill survey link",
        },
      });
    });
  });

  describe("verifyPrefillSurveyToken", () => {
    test("verifies with a pinned HS256 algorithm and decrypts the IDs", () => {
      const result = prefillSurveyLink.verifyPrefillSurveyToken(mockToken);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, ENCRYPTION_KEY, { algorithms: ["HS256"] });
      expect(result).toEqual({
        ok: true,
        data: { responseId: mockResponseId, surveyId: mockSurveyId },
      });
    });

    test("returns an error when verification fails", () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error("Token verification failed");
      });
      vi.spyOn(console, "error").mockImplementation(() => {});

      const result = prefillSurveyLink.verifyPrefillSurveyToken(mockToken);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "bad_request",
          message: "Invalid prefill token",
          details: [{ field: "token", issue: "invalid_token" }],
        });
      }
    });

    test("returns a token_expired error when the token is expired", () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new jwt.TokenExpiredError("jwt expired", new Date());
      });
      vi.spyOn(console, "error").mockImplementation(() => {});

      const result = prefillSurveyLink.verifyPrefillSurveyToken(mockToken);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "bad_request",
          message: "Prefill link has expired",
          details: [{ field: "token", issue: "token_expired" }],
        });
      }
    });

    test("returns an error when the token payload is incomplete", () => {
      vi.mocked(jwt.verify).mockReturnValue({ responseId: mockEncryptedResponseId } as any);
      vi.spyOn(console, "error").mockImplementation(() => {});

      const result = prefillSurveyLink.verifyPrefillSurveyToken(mockToken);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("bad_request");
      }
    });
  });

  describe("getPrefillDataFromResponse", () => {
    test("strips file upload answers but keeps everything else", () => {
      vi.mocked(getElementsFromBlocks).mockReturnValue([
        { id: "openText", type: TSurveyElementTypeEnum.OpenText },
        { id: "fileUpload", type: TSurveyElementTypeEnum.FileUpload },
        { id: "address", type: TSurveyElementTypeEnum.Address },
      ] as any);

      const survey = { id: mockSurveyId, blocks: [] } as unknown as TSurvey;
      const data = {
        openText: "Hello",
        fileUpload: ["https://storage/key.pdf"],
        address: ["Main St", "", "Berlin", "", "10115", "Germany"],
      };

      const result = prefillSurveyLink.getPrefillDataFromResponse(survey, data);

      expect(result).toEqual({
        openText: "Hello",
        address: ["Main St", "", "Berlin", "", "10115", "Germany"],
      });
    });
  });

  describe("getPrefillResponseDataFromToken", () => {
    const survey = { id: mockSurveyId, blocks: [] } as unknown as TSurvey;

    beforeEach(() => {
      vi.mocked(getElementsFromBlocks).mockReturnValue([
        { id: "openText", type: TSurveyElementTypeEnum.OpenText },
      ] as any);
    });

    test("returns prefill data for a valid token and matching response", async () => {
      vi.mocked(getResponse).mockResolvedValue({
        id: mockResponseId,
        surveyId: mockSurveyId,
        data: { openText: "Hi" },
      } as unknown as TResponse);

      const result = await prefillSurveyLink.getPrefillResponseDataFromToken(mockToken, survey);
      expect(getResponse).toHaveBeenCalledWith(mockResponseId);
      expect(result).toEqual({ openText: "Hi" });
    });

    test("returns undefined when the token is invalid", async () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error("invalid");
      });
      vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await prefillSurveyLink.getPrefillResponseDataFromToken(mockToken, survey);
      expect(result).toBeUndefined();
      expect(getResponse).not.toHaveBeenCalled();
    });

    test("returns undefined when the token targets a different survey", async () => {
      const otherSurvey = { id: "other-survey", blocks: [] } as unknown as TSurvey;
      const result = await prefillSurveyLink.getPrefillResponseDataFromToken(mockToken, otherSurvey);
      expect(result).toBeUndefined();
      expect(getResponse).not.toHaveBeenCalled();
    });

    test("returns undefined when the response no longer exists", async () => {
      vi.mocked(getResponse).mockResolvedValue(null);

      const result = await prefillSurveyLink.getPrefillResponseDataFromToken(mockToken, survey);
      expect(result).toBeUndefined();
    });

    test("returns undefined when the response belongs to another survey", async () => {
      vi.mocked(getResponse).mockResolvedValue({
        id: mockResponseId,
        surveyId: "another-survey",
        data: { openText: "Hi" },
      } as unknown as TResponse);

      const result = await prefillSurveyLink.getPrefillResponseDataFromToken(mockToken, survey);
      expect(result).toBeUndefined();
    });
  });
});
