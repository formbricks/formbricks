import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponseUpdateInput } from "@formbricks/types/responses";
import { getOrganization } from "../organization/service";
import { getResponseDownloadFile, responseSelection, updateResponse } from "./service";
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

/**
 * What the Prisma mocks below actually demand.
 *
 * `vi.mocked(prisma.response.findUnique)` types `mockResolvedValue` against the method's default
 * instantiation, so the `select` at the call site is invisible to it and it asks for the **whole**
 * `Response` model — every scalar, not just the fourteen `responseSelection` names. That is what the
 * `as any` casts here were hiding, and it is why this is spelled as the selection plus the two
 * scalars it deliberately leaves out: `contactId`, and `ingestFlags`, which only `updateResponse`'s
 * pre-read selects (keeping it off every response the module returns). Together those are all
 * sixteen columns, and `responseSelection` carries the `contact` and `tags` relations the code under
 * test reads.
 *
 * Worth the indirection because it makes the fixture track the schema: add a column to the model and
 * these tests stop compiling, instead of a cast quietly supplying `undefined` for it.
 */
type MockCurrentResponse = Prisma.ResponseGetPayload<{
  select: typeof responseSelection & { contactId: true; ingestFlags: true };
}>;

const createMockCurrentResponse = (overrides: Partial<MockCurrentResponse> = {}): MockCurrentResponse => ({
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
  contactId: null,
  ingestFlags: null,
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
      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
      vi.mocked(prisma.response.update).mockResolvedValue(currentResponse);

      await updateResponse(mockResponseId, createMockResponseInput({ language: "hi" }));

      expect(prisma.response.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ language: "hi-IN" }) })
      );
    });

    test("preserves the 'default' sentinel and unresolvable codes", async () => {
      const currentResponse = createMockCurrentResponse();
      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
      vi.mocked(prisma.response.update).mockResolvedValue(currentResponse);

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

  /**
   * ENG-1845. The flags are the server's verdict on the incoming data, so they are a separate
   * parameter rather than a key on the client-supplied input — a client could otherwise claim there
   * was nothing to report. On a partial write they union by key: this payload's keys take their new
   * verdict, everything else keeps what it had.
   */
  describe("Embedded Data ingest flags", () => {
    const updateArgs = () => vi.mocked(prisma.response.update).mock.calls[0][0] as { data: unknown };

    test("leaves the stored flags untouched when the caller did not run the contract", async () => {
      const currentResponse = createMockCurrentResponse({
        ingestFlags: [{ key: "seats", reason: "coercion_failed" }],
      });
      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
      vi.mocked(prisma.response.update).mockResolvedValue(currentResponse);

      await updateResponse(mockResponseId, createMockResponseInput({ data: { seats: 12 } }));

      // The authenticated management routes update a response without running the contract, and must
      // not wipe what a client ingest recorded.
      expect(updateArgs().data).not.toHaveProperty("ingestFlags");
    });

    test("persists the flags the contract computed", async () => {
      const currentResponse = createMockCurrentResponse();
      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
      vi.mocked(prisma.response.update).mockResolvedValue(currentResponse);

      await updateResponse(mockResponseId, createMockResponseInput({ data: { seats: "many" } }), undefined, [
        { key: "seats", reason: "coercion_failed" },
      ]);

      expect(updateArgs().data).toMatchObject({
        ingestFlags: [{ key: "seats", reason: "coercion_failed" }],
      });
    });

    test("clears a stored flag once the same key arrives with a value that coerces", async () => {
      const currentResponse = createMockCurrentResponse({
        ingestFlags: [{ key: "seats", reason: "coercion_failed" }],
      });
      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
      vi.mocked(prisma.response.update).mockResolvedValue(currentResponse);

      await updateResponse(mockResponseId, createMockResponseInput({ data: { seats: 12 } }), undefined, []);

      // `[]`, not `null`: null stays reserved for "no ingest boundary has written this".
      expect(updateArgs().data).toMatchObject({ ingestFlags: [] });
    });

    test("keeps a stored flag for a key this payload did not write", async () => {
      const currentResponse = createMockCurrentResponse({
        ingestFlags: [{ key: "seats", reason: "coercion_failed" }],
      });
      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
      vi.mocked(prisma.response.update).mockResolvedValue(currentResponse);

      await updateResponse(
        mockResponseId,
        createMockResponseInput({ data: { plan: "gold" } }),
        undefined,
        []
      );

      expect(updateArgs().data).toMatchObject({
        ingestFlags: [{ key: "seats", reason: "coercion_failed" }],
      });
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

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
      vi.mocked(prisma.response.update).mockResolvedValue({
        ...currentResponse,
        ttc: { element1: 1000, element2: 2000, element3: 3000 },
      });

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

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
      vi.mocked(prisma.response.update).mockResolvedValue(currentResponse);

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

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
      vi.mocked(prisma.response.update).mockResolvedValue({
        ...currentResponse,
        finished: true,
        ttc: { element1: 1000, element2: 2000, element3: 3000, _total: 6000 },
      });

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

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
      vi.mocked(prisma.response.update).mockResolvedValue({
        ...currentResponse,
        ttc: { element1: 1000, element2: 2000 },
      });

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

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
      vi.mocked(prisma.response.update).mockResolvedValue({
        ...currentResponse,
        ttc: { element1: 1000 },
      });

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

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
      vi.mocked(prisma.response.update).mockResolvedValue({
        ...currentResponse,
        ttc: { element1: 1000 },
      });

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

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
      vi.mocked(prisma.response.update).mockResolvedValue({
        ...currentResponse,
        ttc: { element1: 1500 },
      });

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

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
      vi.mocked(prisma.response.update).mockResolvedValue({
        ...currentResponse,
        data: { question1: "answer1", question2: "answer2" },
      });

      await updateResponse(mockResponseId, responseInput);

      expect(prisma.response.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            data: { question1: "answer1", question2: "answer2" },
          }),
        })
      );
    });

    test("preserves stored data and language when the input omits them", async () => {
      // The management API accepts partial bodies (e.g. `{ "finished": true }`), so `data` and
      // `language` can both be absent. Absent must mean "leave the stored column alone" — never
      // overwrite it with an empty value (ENG-2425).
      const currentResponse = createMockCurrentResponse({
        data: { question1: "answer1" },
        language: "de-DE",
      }) as unknown as NonNullable<Awaited<ReturnType<typeof prisma.response.findUnique>>>;

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
      vi.mocked(prisma.response.update).mockResolvedValue(currentResponse);

      await updateResponse(mockResponseId, { finished: true });

      expect(prisma.response.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            finished: true,
            data: { question1: "answer1" },
            // undefined is a Prisma no-op; null or "" would wipe the stored language
            language: undefined,
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

      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
      vi.mocked(prisma.response.update).mockResolvedValue({
        ...currentResponse,
        variables: { var1: "value1", var2: "value2" },
      });

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
      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
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
      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
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
      vi.mocked(prisma.response.findUnique).mockResolvedValue(currentResponse);
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
