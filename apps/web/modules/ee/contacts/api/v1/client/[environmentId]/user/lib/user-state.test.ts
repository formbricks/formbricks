import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TJsPersonState } from "@formbricks/types/js";
import { getPersonSegmentIds } from "./segments";
import { getUserState } from "./user-state";

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      findMany: vi.fn(),
    },
    display: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("./segments", () => ({
  getPersonSegmentIds: vi.fn(),
}));

const mockEnvironmentId = "test-environment-id";
const mockUserId = "test-user-id";
const mockContactId = "test-contact-id";
const mockDevice = "desktop";
const mockAttributes = { email: "test@example.com" };

describe("getUserState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should return user state with empty responses and displays", async () => {
    vi.mocked(prisma.response.findMany).mockResolvedValue([]);
    vi.mocked(prisma.display.findMany).mockResolvedValue([]);
    vi.mocked(getPersonSegmentIds).mockResolvedValue(["segment1"]);

    const result = await getUserState({
      environmentId: mockEnvironmentId,
      userId: mockUserId,
      contactId: mockContactId,
      device: mockDevice,
      attributes: mockAttributes,
    });

    expect(prisma.response.findMany).toHaveBeenCalledWith({
      where: { contactId: mockContactId },
      select: { surveyId: true },
    });
    expect(prisma.display.findMany).toHaveBeenCalledWith({
      where: { contactId: mockContactId },
      select: { surveyId: true, createdAt: true },
    });
    expect(getPersonSegmentIds).toHaveBeenCalledWith(
      mockEnvironmentId,
      mockContactId,
      mockUserId,
      mockAttributes,
      mockDevice
    );
    expect(result).toEqual<TJsPersonState["data"]>({
      contactId: mockContactId,
      userId: mockUserId,
      segments: ["segment1"],
      displays: [],
      responses: [],
      lastDisplayAt: null,
    });
  });

  test("should return user state with responses and displays, and sort displays by createdAt", async () => {
    const mockDate1 = new Date("2023-01-01T00:00:00.000Z");
    const mockDate2 = new Date("2023-01-02T00:00:00.000Z");

    const mockResponses = [{ surveyId: "survey1" }, { surveyId: "survey2" }];
    const mockDisplays = [
      { surveyId: "survey3", createdAt: mockDate1 },
      { surveyId: "survey4", createdAt: mockDate2 }, // most recent
    ];
    vi.mocked(prisma.response.findMany).mockResolvedValue(mockResponses);
    vi.mocked(prisma.display.findMany).mockResolvedValue(mockDisplays);
    vi.mocked(getPersonSegmentIds).mockResolvedValue(["segment2", "segment3"]);

    const result = await getUserState({
      environmentId: mockEnvironmentId,
      userId: mockUserId,
      contactId: mockContactId,
      device: mockDevice,
      attributes: mockAttributes,
    });

    expect(result).toEqual<TJsPersonState["data"]>({
      contactId: mockContactId,
      userId: mockUserId,
      segments: ["segment2", "segment3"],
      displays: [
        { surveyId: "survey4", createdAt: mockDate2 },
        { surveyId: "survey3", createdAt: mockDate1 },
      ],
      responses: ["survey1", "survey2"],
      lastDisplayAt: mockDate2,
    });
  });

  test("should handle null responses and displays from prisma (though unlikely)", async () => {
    // This case tests the nullish coalescing, though prisma.findMany usually returns []
    vi.mocked(prisma.response.findMany).mockResolvedValue(null as any);
    vi.mocked(prisma.display.findMany).mockResolvedValue(null as any);
    vi.mocked(getPersonSegmentIds).mockResolvedValue([]);

    const result = await getUserState({
      environmentId: mockEnvironmentId,
      userId: mockUserId,
      contactId: mockContactId,
      device: mockDevice,
      attributes: mockAttributes,
    });

    expect(result).toEqual<TJsPersonState["data"]>({
      contactId: mockContactId,
      userId: mockUserId,
      segments: [],
      displays: [],
      responses: [],
      lastDisplayAt: null,
    });
  });
});
