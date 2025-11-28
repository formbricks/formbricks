import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponseUpdateInput } from "@formbricks/types/responses";
import { updateResponse } from "./service";
import { calculateTtcTotal } from "./utils";

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
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
  };
});

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
  });
});
