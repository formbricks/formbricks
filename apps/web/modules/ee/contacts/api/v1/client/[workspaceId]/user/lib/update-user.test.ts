import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { updateAttributes } from "@/modules/ee/contacts/lib/attributes";
import { getPersonSegmentIds } from "./segments";
import { updateUser } from "./update-user";

// Mock the cache functions
vi.mock("@/lib/cache", () => ({
  cache: {
    withCache: vi.fn(async (fn) => await fn()), // Just execute the function without caching for tests
  },
}));

vi.mock("@/modules/ee/contacts/lib/attributes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ee/contacts/lib/attributes")>();
  return {
    ...actual,
    updateAttributes: vi.fn(),
  };
});

vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    language: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("./segments", () => ({
  getPersonSegmentIds: vi.fn(),
}));

const mockWorkspaceId = "workspace-id-mock";
const mockUserId = "test-user-id";
const mockContactId = "test-contact-id";

const mockContactData = {
  id: mockContactId,
  attributes: [
    { attributeKey: { key: "userId" }, value: mockUserId },
    { attributeKey: { key: "email" }, value: "test@example.com" },
  ],
  responses: [],
  displays: [],
};

describe("updateUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Mock successful attribute updates
    vi.mocked(updateAttributes).mockResolvedValue({ success: true, messages: [] });
    // Mock segments
    vi.mocked(getPersonSegmentIds).mockResolvedValue(["segment1"]);
    // Default: workspace has no configured languages, so a non-canonical value is treated as junk.
    vi.mocked(prisma.language.findMany).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should create a new contact if not found", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.contact.create).mockResolvedValue(mockContactData as any);

    const result = await updateUser(mockWorkspaceId, mockUserId, "desktop");

    expect(prisma.contact.create).toHaveBeenCalledWith({
      data: {
        workspace: { connect: { id: mockWorkspaceId } },
        attributes: {
          create: [
            {
              attributeKey: {
                connect: { key_workspaceId: { key: "userId", workspaceId: mockWorkspaceId } },
              },
              value: mockUserId,
            },
          ],
        },
      },
      select: {
        id: true,
        attributes: {
          select: {
            attributeKey: { select: { key: true } },
            value: true,
          },
        },
        responses: {
          select: { surveyId: true, createdAt: true, finished: true },
        },
        displays: {
          select: {
            surveyId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    expect(result.state.data).toEqual(
      expect.objectContaining({
        contactId: mockContactId,
        userId: mockUserId,
        segments: ["segment1"],
        displays: [],
        responses: [],
        lastDisplayAt: null,
      })
    );
    expect(result.messages).toBeUndefined();
  });

  test("should update existing contact attributes and canonicalize the language", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactData as any);
    const newAttributes = { email: "new@example.com", language: "en" };

    const result = await updateUser(mockWorkspaceId, mockUserId, "desktop", newAttributes);

    // `en` is stored as its canonical BCP-47 tag `en-US`, but echoed back to the SDK in its bare legacy
    // form `en` (transitional SDK back-compat — see toLegacyLanguageCodes).
    expect(updateAttributes).toHaveBeenCalledWith(mockContactId, mockUserId, mockWorkspaceId, {
      email: "new@example.com",
      language: "en-US",
    });
    expect(result.state.data?.language).toBe("en");
    expect(result.messages).toBeUndefined();
  });

  test("should leave an already-canonical language untouched", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactData as any);
    const newAttributes = { email: "new@example.com", language: "de-DE" };

    const result = await updateUser(mockWorkspaceId, mockUserId, "desktop", newAttributes);

    expect(updateAttributes).toHaveBeenCalledWith(mockContactId, mockUserId, mockWorkspaceId, {
      email: "new@example.com",
      language: "de-DE",
    });
    // stored canonical `de-DE`, echoed back to the SDK as bare legacy `de`
    expect(result.state.data?.language).toBe("de");
  });

  test("should drop an invalid (unresolvable) language but keep other attributes", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactData as any);
    const newAttributes = { email: "new@example.com", language: "123" };

    const result = await updateUser(mockWorkspaceId, mockUserId, "desktop", newAttributes);

    // invalid language is removed from the write payload; the rest of the attributes still persist
    expect(updateAttributes).toHaveBeenCalledWith(mockContactId, mockUserId, mockWorkspaceId, {
      email: "new@example.com",
    });
    expect(result.state.data?.language).toBeUndefined();
    // ...and the caller is told the language was ignored
    expect(result.messages).toContain(
      "Ignored invalid language code '123'. The existing value was preserved."
    );
  });

  test("keeps a non-canonical value that is a configured survey-language alias (setLanguage(alias))", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactData as any);
    // Workspace has a German language whose custom alias is the human word "deutsch".
    vi.mocked(prisma.language.findMany).mockResolvedValue([{ code: "de-DE", alias: "deutsch" }] as any);
    const newAttributes = { email: "new@example.com", language: "deutsch" };

    const result = await updateUser(mockWorkspaceId, mockUserId, "desktop", newAttributes);

    // The alias doesn't canonicalize, but it matches a configured language -> stored verbatim, not dropped.
    expect(updateAttributes).toHaveBeenCalledWith(mockContactId, mockUserId, mockWorkspaceId, {
      email: "new@example.com",
      language: "deutsch",
    });
    // ...and it is echoed back verbatim so the SDK still matches the survey's "deutsch" alias.
    expect(result.state.data?.language).toBe("deutsch");
    expect(result.messages).toBeUndefined();
  });

  test("matches a configured alias case-insensitively and stores the configured casing", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactData as any);
    // Configured alias is lowercase "deutsch"; the SDK sends "DEUTSCH". Matching is case-insensitive
    // everywhere, so it's kept — and normalized to the CONFIGURED casing ("deutsch"), not the caller's
    // ("DEUTSCH"), so the persisted/echoed value stays consistent with the workspace config (mirrors how
    // codes are canonicalized).
    vi.mocked(prisma.language.findMany).mockResolvedValue([{ code: "de-DE", alias: "deutsch" }] as any);
    const newAttributes = { email: "new@example.com", language: "DEUTSCH" };

    const result = await updateUser(mockWorkspaceId, mockUserId, "desktop", newAttributes);

    expect(updateAttributes).toHaveBeenCalledWith(mockContactId, mockUserId, mockWorkspaceId, {
      email: "new@example.com",
      language: "deutsch",
    });
    expect(result.state.data?.language).toBe("deutsch");
    expect(result.messages).toBeUndefined();
  });

  test("surfaces a falsy-but-real invalid language (e.g. 0) instead of silently dropping it", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactData as any);
    const newAttributes = { email: "new@example.com", language: 0 };

    const result = await updateUser(mockWorkspaceId, mockUserId, "desktop", newAttributes);

    expect(updateAttributes).toHaveBeenCalledWith(mockContactId, mockUserId, mockWorkspaceId, {
      email: "new@example.com",
    });
    expect(result.state.data?.language).toBeUndefined();
    expect(result.messages).toContain("Ignored invalid language code '0'. The existing value was preserved.");
  });

  test("silently drops a blank / whitespace-only language (no message)", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactData as any);
    const newAttributes = { email: "new@example.com", language: "   " };

    const result = await updateUser(mockWorkspaceId, mockUserId, "desktop", newAttributes);

    expect(updateAttributes).toHaveBeenCalledWith(mockContactId, mockUserId, mockWorkspaceId, {
      email: "new@example.com",
    });
    expect(result.state.data?.language).toBeUndefined();
    expect(result.messages).toBeUndefined();
  });

  test("should not update attributes if they are the same", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactData as any);
    const existingAttributes = { email: "test@example.com" }; // Same as in mockContactData

    await updateUser(mockWorkspaceId, mockUserId, "desktop", existingAttributes);

    expect(updateAttributes).not.toHaveBeenCalled();
  });

  test("should return messages from updateAttributes if any", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactData as any);
    const newAttributes = { company: "Formbricks" };
    const updateMessages = [
      { code: "new_attribute_created", params: { key: "company", dataType: "string" } },
    ];
    vi.mocked(updateAttributes).mockResolvedValue({ success: true, messages: updateMessages });

    const result = await updateUser(mockWorkspaceId, mockUserId, "desktop", newAttributes);

    expect(updateAttributes).toHaveBeenCalledWith(mockContactId, mockUserId, mockWorkspaceId, newAttributes);
    expect(result.messages).toEqual(["Created new attribute 'company' with type 'string'"]);
  });

  test("should use device type 'phone'", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactData as any);
    await updateUser(mockWorkspaceId, mockUserId, "phone");
    expect(getPersonSegmentIds).toHaveBeenCalledWith(mockWorkspaceId, mockContactId, mockUserId, "phone", {
      displays: [],
      responses: [],
    });
  });

  test("should use device type 'desktop'", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactData as any);
    await updateUser(mockWorkspaceId, mockUserId, "desktop");
    expect(getPersonSegmentIds).toHaveBeenCalledWith(mockWorkspaceId, mockContactId, mockUserId, "desktop", {
      displays: [],
      responses: [],
    });
  });
});
