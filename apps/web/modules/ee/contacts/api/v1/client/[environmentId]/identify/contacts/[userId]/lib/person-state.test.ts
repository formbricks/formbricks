import { getEnvironment } from "@/lib/environment/service";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getPersonSegmentIds } from "@/modules/ee/contacts/api/v1/client/[environmentId]/user/lib/segments";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TEnvironment } from "@formbricks/types/environment";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TOrganization } from "@formbricks/types/organizations";
import { getContactByUserId } from "./contact";
import { getPersonState } from "./person-state";

vi.mock("@/lib/environment/service", () => ({
  getEnvironment: vi.fn(),
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationByEnvironmentId: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/api/v1/client/[environmentId]/identify/contacts/[userId]/lib/contact", () => ({
  getContactByUserId: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      create: vi.fn(),
    },
    response: {
      findMany: vi.fn(),
    },
    display: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock(
  "@/modules/ee/contacts/api/v1/client/[environmentId]/identify/contacts/[userId]/lib/attributes",
  () => ({
    getContactAttributes: vi.fn(),
  })
);

vi.mock("@/modules/ee/contacts/api/v1/client/[environmentId]/user/lib/segments", () => ({
  getPersonSegmentIds: vi.fn(),
}));

const mockEnvironmentId = "jubz514cwdmjvnbadsfd7ez3";
const mockUserId = "huli1kfpw1r6vn00vjxetdob";
const mockContactId = "e71zwzi6zgrdzutbb0q8spui";
const mockProjectId = "d6o07l7ieizdioafgelrioao";
const mockOrganizationId = "xa4oltlfkmqq3r4e3m3ocss1";
const mockDevice = "desktop";

const mockEnvironment: TEnvironment = {
  id: mockEnvironmentId,
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "development",
  projectId: mockProjectId,
  appSetupCompleted: false,
};

const mockOrganization: TOrganization = {
  id: mockOrganizationId,
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Organization",
  billing: {
    stripeCustomerId: null,
    plan: "free",
    period: "monthly",
    limits: { projects: 1, monthly: { responses: 100, miu: 100 } },
    periodStart: new Date(),
  },
  isAIEnabled: false,
};

const mockResolvedContactFromGetContactByUserId = {
  id: mockContactId,
  createdAt: new Date(),
  updatedAt: new Date(),
  environmentId: mockEnvironmentId,
  userId: mockUserId,
};

const mockResolvedContactFromPrismaCreate = {
  id: mockContactId,
  createdAt: new Date(),
  updatedAt: new Date(),
  environmentId: mockEnvironmentId,
  userId: mockUserId,
};

describe("getPersonState", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should throw ResourceNotFoundError if environment is not found", async () => {
    vi.mocked(getEnvironment).mockResolvedValue(null);
    await expect(
      getPersonState({ environmentId: mockEnvironmentId, userId: mockUserId, device: mockDevice })
    ).rejects.toThrow(new ResourceNotFoundError("environment", mockEnvironmentId));
  });

  test("should throw ResourceNotFoundError if organization is not found", async () => {
    vi.mocked(getEnvironment).mockResolvedValue(mockEnvironment as TEnvironment);
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(null);
    await expect(
      getPersonState({ environmentId: mockEnvironmentId, userId: mockUserId, device: mockDevice })
    ).rejects.toThrow(new ResourceNotFoundError("organization", mockEnvironmentId));
  });

  test("should return person state if contact exists", async () => {
    vi.mocked(getEnvironment).mockResolvedValue(mockEnvironment as TEnvironment);
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization as TOrganization);
    vi.mocked(getContactByUserId).mockResolvedValue(mockResolvedContactFromGetContactByUserId);
    vi.mocked(prisma.response.findMany).mockResolvedValue([]);
    vi.mocked(prisma.display.findMany).mockResolvedValue([]);
    vi.mocked(getPersonSegmentIds).mockResolvedValue([]);

    const result = await getPersonState({
      environmentId: mockEnvironmentId,
      userId: mockUserId,
      device: mockDevice,
    });

    expect(result.state.contactId).toBe(mockContactId);
    expect(result.state.userId).toBe(mockUserId);
    expect(result.state.segments).toEqual([]);
    expect(result.state.displays).toEqual([]);
    expect(result.state.responses).toEqual([]);
    expect(result.state.lastDisplayAt).toBeNull();
    expect(result.revalidateProps).toBeUndefined();
    expect(prisma.contact.create).not.toHaveBeenCalled();
  });

  test("should create contact and return person state if contact does not exist", async () => {
    vi.mocked(getEnvironment).mockResolvedValue(mockEnvironment as TEnvironment);
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization as TOrganization);
    vi.mocked(getContactByUserId).mockResolvedValue(null);
    vi.mocked(prisma.contact.create).mockResolvedValue(mockResolvedContactFromPrismaCreate as any);
    vi.mocked(prisma.response.findMany).mockResolvedValue([]);
    vi.mocked(prisma.display.findMany).mockResolvedValue([]);
    vi.mocked(getPersonSegmentIds).mockResolvedValue(["segment1"]);

    const result = await getPersonState({
      environmentId: mockEnvironmentId,
      userId: mockUserId,
      device: mockDevice,
    });

    expect(prisma.contact.create).toHaveBeenCalledWith({
      data: {
        environment: { connect: { id: mockEnvironmentId } },
        attributes: {
          create: [
            {
              attributeKey: {
                connect: { key_environmentId: { key: "userId", environmentId: mockEnvironmentId } },
              },
              value: mockUserId,
            },
          ],
        },
      },
    });
    expect(result.state.contactId).toBe(mockContactId);
    expect(result.state.userId).toBe(mockUserId);
    expect(result.state.segments).toEqual(["segment1"]);
    expect(result.revalidateProps).toEqual({ contactId: mockContactId, revalidate: true });
  });

  test("should correctly map displays and responses", async () => {
    const displayDate = new Date();
    const mockDisplays = [
      { surveyId: "survey1", createdAt: displayDate },
      { surveyId: "survey2", createdAt: new Date(displayDate.getTime() - 1000) },
    ];
    const mockResponses = [{ surveyId: "survey1" }, { surveyId: "survey3" }];

    vi.mocked(getEnvironment).mockResolvedValue(mockEnvironment as TEnvironment);
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization as TOrganization);
    vi.mocked(getContactByUserId).mockResolvedValue(mockResolvedContactFromGetContactByUserId);
    vi.mocked(prisma.response.findMany).mockResolvedValue(mockResponses as any);
    vi.mocked(prisma.display.findMany).mockResolvedValue(mockDisplays as any);
    vi.mocked(getPersonSegmentIds).mockResolvedValue([]);

    const result = await getPersonState({
      environmentId: mockEnvironmentId,
      userId: mockUserId,
      device: mockDevice,
    });

    expect(result.state.displays).toEqual(
      mockDisplays.map((d) => ({ surveyId: d.surveyId, createdAt: d.createdAt }))
    );
    expect(result.state.responses).toEqual(mockResponses.map((r) => r.surveyId));
    expect(result.state.lastDisplayAt).toEqual(displayDate);
  });
});
