import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponseUpdateInput } from "@formbricks/types/responses";
import { getOrganization } from "../organization/service";
import { getResponseDownloadFile, updateResponse } from "./service";
import { calculateTtcTotal, getResponsesJson } from "./utils";

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("./utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./utils")>();
  return {
    ...actual,
    calculateTtcTotal: vi.fn((ttc) => ({
      ...ttc,
      _total: Object.values(ttc as Record<string, number>).reduce((a, b) => a + b, 0),
    })),
    extractSurveyDetails: vi.fn(() => ({
      metaDataFields: [],
      elements: [],
      hiddenFields: [],
      variables: [],
      userAttributes: [],
    })),
    getResponsesJson: vi.fn(() => []),
  };
});

vi.mock("../survey/service", () => ({
  getSurvey: vi.fn(() =>
    Promise.resolve({
      id: "survey-123",
      name: "Test Survey",
      workspaceId: "workspace-123",
      isVerifyEmailEnabled: false,
    })
  ),
}));

vi.mock("@/modules/survey/lib/organization", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn(() => Promise.resolve("org-123")),
}));

vi.mock("@/modules/survey/lib/survey", () => ({
  getOrganizationBilling: vi.fn(() => Promise.resolve({ limits: {} })),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsQuotasEnabled: vi.fn(() => Promise.resolve(false)),
}));

vi.mock("../organization/service", () => ({
  getOrganization: vi.fn(),
}));

vi.mock("../utils/file-conversion", () => ({
  convertToCsv: vi.fn(() => Promise.resolve("csv-content")),
  convertToXlsxBuffer: vi.fn(() => Buffer.from("xlsx-content")),
}));

const mockResponseId = "response-123";

const createMockCurrentResponse = (overrides: Record<string, unknown> = {}) => ({
  id: mockResponseId,
  createdAt: new Date(),
  updatedAt: new Date(),
  surveyId: "survey-123",
  finished: false,
  endingId: null,
  data: {},
  meta: {},
  ttc: {},
  variables: {},
  contactAttributes: {},
  singleUseId: null,
  language: "en",
  displayId: "display-123",
  contact: null,
  tags: [],
  ...overrides,
});

const createMockResponseInput = (overrides: Partial<TResponseUpdateInput> = {}): TResponseUpdateInput => ({
  finished: false,
  data: {},
  ...overrides,
});

describe("updateResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("language canonicalization (ENG-1067)", () => {
    test("canonicalizes a legacy language code on update", async () => {
      const currentResponse = createMockCurrentResponse();
      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse as any);
      vi.mocked(prisma.response.update).mockResolvedValue(currentResponse as any);

      await updateResponse(mockResponseId, createMockResponseInput({ language: "hi" }));

      expect(prisma.response.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ language: "hi-IN" }) })
      );
    });

    test("preserves the 'default' sentinel and unresolvable codes", async () => {
      const currentResponse = createMockCurrentResponse();
      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse as any);
      vi.mocked(prisma.response.update).mockResolvedValue(currentResponse as any);

      await updateResponse(mockResponseId, createMockResponseInput({ language: "default" }));
      expect(prisma.response.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ language: "default" }) })
      );

      await updateResponse(mockResponseId, createMockResponseInput({ language: "123" }));
      expect(prisma.response.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ language: "123" }) })
      );
    });
  });

  describe("TTC merging behavior", () => {
    test("should merge new TTC with existing TTC from previous blocks", async () => {
      const currentResponse = createMockCurrentResponse({
        ttc: { element1: 1000, element2: 2000 },
      });

      const responseInput = createMockResponseInput({
        ttc: { element3: 3000 },
        finished: false,
      });

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse as any);
      vi.mocked(prisma.response.update).mockResolvedValue({
        ...currentResponse,
        ttc: { element1: 1000, element2: 2000, element3: 3000 },
      } as any);

      await updateResponse(mockResponseId, responseInput);

      expect(prisma.response.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ttc: { element1: 1000, element2: 2000, element3: 3000 },
          }),
        })
      );
    });

    test("should preserve existing TTC when no new TTC is provided", async () => {
      const currentResponse = createMockCurrentResponse({
        ttc: { element1: 1000, element2: 2000 },
      });

      const responseInput = createMockResponseInput({
        finished: false,
      });

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse as any);
      vi.mocked(prisma.response.update).mockResolvedValue(currentResponse as any);

      await updateResponse(mockResponseId, responseInput);

      expect(prisma.response.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ttc: { element1: 1000, element2: 2000 },
          }),
        })
      );
    });

    test("should calculate total TTC when response is finished", async () => {
      const currentResponse = createMockCurrentResponse({
        ttc: { element1: 1000, element2: 2000 },
      });

      const responseInput = createMockResponseInput({
        ttc: { element3: 3000 },
        finished: true,
      });

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse as any);
      vi.mocked(prisma.response.update).mockResolvedValue({
        ...currentResponse,
        finished: true,
        ttc: { element1: 1000, element2: 2000, element3: 3000, _total: 6000 },
      } as any);

      await updateResponse(mockResponseId, responseInput);

      expect(calculateTtcTotal).toHaveBeenCalledWith({
        element1: 1000,
        element2: 2000,
        element3: 3000,
      });
    });

    test("should not calculate total TTC when response is not finished", async () => {
      const currentResponse = createMockCurrentResponse({
        ttc: { element1: 1000 },
      });

      const responseInput = createMockResponseInput({
        ttc: { element2: 2000 },
        finished: false,
      });

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse as any);
      vi.mocked(prisma.response.update).mockResolvedValue({
        ...currentResponse,
        ttc: { element1: 1000, element2: 2000 },
      } as any);

      await updateResponse(mockResponseId, responseInput);

      expect(calculateTtcTotal).not.toHaveBeenCalled();
    });

    test("should handle empty existing TTC", async () => {
      const currentResponse = createMockCurrentResponse({
        ttc: {},
      });

      const responseInput = createMockResponseInput({
        ttc: { element1: 1000 },
        finished: false,
      });

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse as any);
      vi.mocked(prisma.response.update).mockResolvedValue({
        ...currentResponse,
        ttc: { element1: 1000 },
      } as any);

      await updateResponse(mockResponseId, responseInput);

      expect(prisma.response.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ttc: { element1: 1000 },
          }),
        })
      );
    });

    test("should handle null existing TTC", async () => {
      const currentResponse = createMockCurrentResponse({
        ttc: null,
      });

      const responseInput = createMockResponseInput({
        ttc: { element1: 1000 },
        finished: false,
      });

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse as any);
      vi.mocked(prisma.response.update).mockResolvedValue({
        ...currentResponse,
        ttc: { element1: 1000 },
      } as any);

      await updateResponse(mockResponseId, responseInput);

      expect(prisma.response.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ttc: { element1: 1000 },
          }),
        })
      );
    });

    test("should overwrite existing element TTC with new value for same element", async () => {
      const currentResponse = createMockCurrentResponse({
        ttc: { element1: 1000 },
      });

      const responseInput = createMockResponseInput({
        ttc: { element1: 1500 },
        finished: false,
      });

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse as any);
      vi.mocked(prisma.response.update).mockResolvedValue({
        ...currentResponse,
        ttc: { element1: 1500 },
      } as any);

      await updateResponse(mockResponseId, responseInput);

      expect(prisma.response.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ttc: { element1: 1500 },
          }),
        })
      );
    });
  });

  describe("data merging behavior", () => {
    test("should merge new data with existing data", async () => {
      const currentResponse = createMockCurrentResponse({
        data: { question1: "answer1" },
      });

      const responseInput = createMockResponseInput({
        data: { question2: "answer2" },
        finished: false,
      });

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse as any);
      vi.mocked(prisma.response.update).mockResolvedValue({
        ...currentResponse,
        data: { question1: "answer1", question2: "answer2" },
      } as any);

      await updateResponse(mockResponseId, responseInput);

      expect(prisma.response.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            data: { question1: "answer1", question2: "answer2" },
          }),
        })
      );
    });
  });

  describe("variables merging behavior", () => {
    test("should merge new variables with existing variables", async () => {
      const currentResponse = createMockCurrentResponse({
        variables: { var1: "value1" },
      });

      const responseInput = createMockResponseInput({
        variables: { var2: "value2" },
        finished: false,
      });

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse as any);
      vi.mocked(prisma.response.update).mockResolvedValue({
        ...currentResponse,
        variables: { var1: "value1", var2: "value2" },
      } as any);

      await updateResponse(mockResponseId, responseInput);

      expect(prisma.response.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            variables: { var1: "value1", var2: "value2" },
          }),
        })
      );
    });
  });

  describe("error handling", () => {
    test("should throw ResourceNotFoundError when response does not exist", async () => {
      vi.mocked(prisma.response.findUnique).mockResolvedValue(null);

      const responseInput = createMockResponseInput();

      await expect(updateResponse(mockResponseId, responseInput)).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw DatabaseError on Prisma errors", async () => {
      const currentResponse = createMockCurrentResponse();
      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse as any);
      vi.mocked(prisma.response.update).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Database error", {
          code: "P2002",
          clientVersion: "5.0.0",
        })
      );

      const responseInput = createMockResponseInput();

      await expect(updateResponse(mockResponseId, responseInput)).rejects.toThrow(DatabaseError);
    });

    test("should throw ResourceNotFoundError when response is deleted during update", async () => {
      const currentResponse = createMockCurrentResponse();
      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse as any);
      vi.mocked(prisma.response.update).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Record to update not found", {
          code: PrismaErrorType.RecordNotFound,
          clientVersion: "5.0.0",
        })
      );

      const responseInput = createMockResponseInput();

      await expect(updateResponse(mockResponseId, responseInput)).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw ResourceNotFoundError when Prisma reports a missing response record", async () => {
      const currentResponse = createMockCurrentResponse();
      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse as any);
      vi.mocked(prisma.response.update).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Record does not exist", {
          code: PrismaErrorType.RecordNotFound,
          clientVersion: "5.0.0",
        })
      );

      const responseInput = createMockResponseInput();

      await expect(updateResponse(mockResponseId, responseInput)).rejects.toThrow(ResourceNotFoundError);
    });
  });
});

describe("getResponseDownloadFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.response.findMany).mockResolvedValue([] as any);
  });

  test("forwards the organization display time zone to getResponsesJson", async () => {
    vi.mocked(getOrganization).mockResolvedValue({ displayTimeZone: "Asia/Manila" } as any);

    await getResponseDownloadFile("survey-123", "csv");

    expect(getResponsesJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      false,
      "Asia/Manila"
    );
  });

  test("defaults to UTC when the organization has no display time zone", async () => {
    vi.mocked(getOrganization).mockResolvedValue({ displayTimeZone: null } as any);

    await getResponseDownloadFile("survey-123", "csv");

    expect(getResponsesJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      false,
      "UTC"
    );
  });
});
