import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { AuthorizationError, OperationNotAllowedError } from "@formbricks/types/errors";
import { assertCan } from "@/lib/authorization";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import {
  ContactDirectoryMissingError,
  requireWorkspaceContactDirectory,
} from "@/modules/ee/contacts/lib/contact-directory";
import { createContactsFromCSVAction, deleteContactAction, updateContactAttributesAction } from "./actions";
import { CONTACT_IN_SHARED_DIRECTORY_ERROR_CODE } from "./lib/contact-delete-errors";
import { ContactInSharedDirectoryError, deleteContactInWorkspace } from "./lib/contacts";
import { createContactsFromCSV } from "./lib/contacts-csv-upload";
import { updateContactAttributes } from "./lib/update-contact-attributes";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { contact: { count: vi.fn() } } }));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: { inputSchema: vi.fn().mockReturnThis(), action: vi.fn((fn) => fn) },
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_action, _target, fn) => fn),
}));
vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: { actions: { stateMutation: {} } },
}));
vi.mock("@/modules/ee/contacts/lib/contacts-entitlement", () => ({ ensureContactsEnabled: vi.fn() }));
vi.mock("@/modules/ee/contacts/lib/contact-directory", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/contacts/lib/contact-directory")>()),
  requireWorkspaceContactDirectory: vi.fn(),
}));
vi.mock("./lib/contacts", async (importOriginal) => ({
  ContactInSharedDirectoryError: (await importOriginal<typeof import("./lib/contacts")>())
    .ContactInSharedDirectoryError,
  deleteContactInWorkspace: vi.fn(),
}));
vi.mock("./lib/contacts-csv-upload", () => ({ createContactsFromCSV: vi.fn() }));
vi.mock("./lib/update-contact-attributes", () => ({ updateContactAttributes: vi.fn() }));

type TActionArgs = { ctx: object; parsedInput: object };
const run = (action: unknown, parsedInput: object) =>
  (action as (args: TActionArgs) => Promise<unknown>)({
    ctx: { user: { id: "user_1" }, auditLoggingCtx: {} },
    parsedInput,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue("org_1");
});

// The workspace comes from the page, never from the contact, whose `workspaceId` only records where
// it was created. The lib calls then require the contact to be in that workspace's directory.
describe("deleteContactAction", () => {
  test("authorizes on the page's workspace and deletes within its directory", async () => {
    vi.mocked(deleteContactInWorkspace).mockResolvedValue({ id: "contact_1" } as never);

    await run(deleteContactAction, { contactId: "contact_1", workspaceId: "ws_1" });

    expect(assertCan).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "workspace.write", {
      type: "workspace",
      id: "ws_1",
    });
    expect(deleteContactInWorkspace).toHaveBeenCalledWith("contact_1", "ws_1");
  });

  test("deletes nothing when the caller may not write the workspace", async () => {
    vi.mocked(assertCan).mockRejectedValueOnce(new AuthorizationError("Not authorized"));

    await expect(run(deleteContactAction, { contactId: "contact_1", workspaceId: "ws_1" })).rejects.toThrow(
      AuthorizationError
    );
    expect(deleteContactInWorkspace).not.toHaveBeenCalled();
  });

  test("answers a shared directory with the code the page translates", async () => {
    vi.mocked(deleteContactInWorkspace).mockRejectedValue(new ContactInSharedDirectoryError());

    await expect(run(deleteContactAction, { contactId: "contact_1", workspaceId: "ws_1" })).rejects.toThrow(
      new OperationNotAllowedError(CONTACT_IN_SHARED_DIRECTORY_ERROR_CODE)
    );
  });
});

describe("updateContactAttributesAction", () => {
  test("authorizes on the page's workspace and updates within its directory", async () => {
    vi.mocked(updateContactAttributes).mockResolvedValue({ updatedAttributes: {} });

    await run(updateContactAttributesAction, {
      contactId: "contact_1",
      workspaceId: "ws_1",
      attributes: { plan: "pro" },
    });

    expect(assertCan).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "workspace.write", {
      type: "workspace",
      id: "ws_1",
    });
    expect(updateContactAttributes).toHaveBeenCalledWith("contact_1", "ws_1", { plan: "pro" });
  });

  test("updates nothing when the caller may not write the workspace", async () => {
    vi.mocked(assertCan).mockRejectedValueOnce(new AuthorizationError("Not authorized"));

    await expect(
      run(updateContactAttributesAction, { contactId: "contact_1", workspaceId: "ws_1", attributes: {} })
    ).rejects.toThrow(AuthorizationError);
    expect(updateContactAttributes).not.toHaveBeenCalled();
  });
});

describe("createContactsFromCSVAction", () => {
  const upload = {
    csvData: [{ email: "a@example.com" }],
    workspaceId: "ws_1",
    duplicateContactsAction: "update",
    attributeMap: {},
  };

  test("refuses a workspace with no contact directory before any read or write", async () => {
    vi.mocked(requireWorkspaceContactDirectory).mockRejectedValue(new ContactDirectoryMissingError());

    await expect(run(createContactsFromCSVAction, upload)).rejects.toThrow(
      "A contact directory needs to be set up for this workspace before contacts are available."
    );
    expect(prisma.contact.count).not.toHaveBeenCalled();
    expect(createContactsFromCSV).not.toHaveBeenCalled();
  });

  test("uploads into the workspace's directory and returns the multi-match count", async () => {
    const directory = { id: "directory_1", matchingKey: "email" as const };
    vi.mocked(requireWorkspaceContactDirectory).mockResolvedValue(directory);
    vi.mocked(prisma.contact.count).mockResolvedValue(3);
    vi.mocked(createContactsFromCSV).mockResolvedValue({ contacts: [], multiMatchCount: 2 });

    const result = await run(createContactsFromCSVAction, upload);

    expect(prisma.contact.count).toHaveBeenCalledWith({ where: { directoryId: "directory_1" } });
    expect(createContactsFromCSV).toHaveBeenCalledWith(
      [{ email: "a@example.com" }],
      "ws_1",
      directory,
      "update",
      {}
    );
    expect(result).toEqual({ contacts: [], multiMatchCount: 2 });
  });
});
