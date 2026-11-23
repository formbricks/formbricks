import { beforeEach, describe, expect, test, vi } from "vitest";
import { ContactDirectoryMissingError } from "@/modules/ee/contacts/lib/contact-directory";

const mocks = vi.hoisted(() => ({
  contactCount: vi.fn(),
  createContactsFromCSV: vi.fn(),
  requireWorkspaceContactDirectory: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({ prisma: { contact: { count: mocks.contactCount } } }));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({ action: vi.fn((fn) => fn) })),
  },
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));
vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromContactId: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn().mockResolvedValue("org-1"),
  getWorkspaceIdFromContactId: vi.fn(),
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/modules/ee/contacts/lib/contacts-entitlement", () => ({ ensureContactsEnabled: vi.fn() }));
vi.mock("@/modules/ee/contacts/lib/contact-directory", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/contacts/lib/contact-directory")>()),
  requireWorkspaceContactDirectory: mocks.requireWorkspaceContactDirectory,
}));
vi.mock("./lib/contacts", () => ({
  createContactsFromCSV: mocks.createContactsFromCSV,
  deleteContact: vi.fn(),
  getContact: vi.fn(),
}));
vi.mock("./lib/update-contact-attributes", () => ({ updateContactAttributes: vi.fn() }));

// Import after mocks so the action client / audit wrappers are the passthrough versions.
const { createContactsFromCSVAction } = await import("./actions");

const callUpload = () =>
  (createContactsFromCSVAction as unknown as (args: unknown) => Promise<unknown>)({
    ctx: { user: { id: "user-1" }, auditLoggingCtx: {} },
    parsedInput: {
      csvData: [{ email: "a@example.com" }],
      workspaceId: "workspace-1",
      duplicateContactsAction: "update",
      attributeMap: {},
    },
  });

describe("createContactsFromCSVAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("refuses a workspace with no contact directory before any read or write", async () => {
    mocks.requireWorkspaceContactDirectory.mockRejectedValue(new ContactDirectoryMissingError());

    await expect(callUpload()).rejects.toThrow(
      "A contact directory needs to be set up for this workspace before contacts are available."
    );
    expect(mocks.contactCount).not.toHaveBeenCalled();
    expect(mocks.createContactsFromCSV).not.toHaveBeenCalled();
  });

  test("uploads into the workspace's directory and returns the multi-match count", async () => {
    const directory = { id: "directory-1", matchingKey: "email" };
    mocks.requireWorkspaceContactDirectory.mockResolvedValue(directory);
    mocks.contactCount.mockResolvedValue(3);
    mocks.createContactsFromCSV.mockResolvedValue({ contacts: [], multiMatchCount: 2 });

    const result = await callUpload();

    expect(mocks.contactCount).toHaveBeenCalledWith({ where: { directoryId: "directory-1" } });
    expect(mocks.createContactsFromCSV).toHaveBeenCalledWith(
      [{ email: "a@example.com" }],
      "workspace-1",
      directory,
      "update",
      {}
    );
    expect(result).toEqual({ contacts: [], multiMatchCount: 2 });
  });
});
