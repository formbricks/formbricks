import { beforeEach, describe, expect, test, vi } from "vitest";
import { ContactInSharedDirectoryError } from "@/modules/ee/contacts/lib/contacts";
import { DELETE, GET } from "./route";

// `withV1ApiWrapper` is reduced to its handler. What is proved here: the contact is reached through
// its directory, never its own `workspaceId`, and a shared directory refuses the delete (decision 9).
const mocks = vi.hoisted(() => ({
  deleteContactInWorkspace: vi.fn(),
  findApiKeyWorkspaceOnDirectory: vi.fn(),
  getContact: vi.fn(),
}));

vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn(async () => true) }));
vi.mock("@/modules/ee/contacts/lib/api-key-directory-access", () => ({
  findApiKeyWorkspaceOnDirectory: mocks.findApiKeyWorkspaceOnDirectory,
}));
vi.mock("@/modules/ee/contacts/lib/contacts", async (importOriginal) => ({
  ContactInSharedDirectoryError: (await importOriginal<typeof import("@/modules/ee/contacts/lib/contacts")>())
    .ContactInSharedDirectoryError,
  deleteContactInWorkspace: mocks.deleteContactInWorkspace,
}));
vi.mock("./lib/contact", () => ({ getContact: mocks.getContact }));

const CONTACT_ID = "clct00000000000000000001";
const createdAt = new Date("2024-01-01T00:00:00.000Z");

const call = (handler: unknown) =>
  (handler as (input: unknown) => Promise<{ response: Response }>)({
    req: new Request(`http://localhost/api/v1/management/contacts/${CONTACT_ID}`),
    props: { params: Promise.resolve({ contactId: CONTACT_ID }) },
    authentication: {
      apiKeyId: "key-1",
      organizationId: "org-1",
      workspacePermissions: [{ workspaceId: "ws-b" }, { workspaceId: "ws-c" }],
    },
  });

describe("/api/v1/management/contacts/[contactId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Created in workspace A, whose directory the key reaches through workspace B.
    mocks.getContact.mockResolvedValue({
      id: CONTACT_ID,
      createdAt,
      updatedAt: createdAt,
      workspaceId: "ws-a",
      directoryId: "dir-1",
    });
    mocks.findApiKeyWorkspaceOnDirectory.mockResolvedValue("ws-b");
  });

  test("GET reaches the contact through its directory and keeps the v1 shape", async () => {
    const { response } = await call(GET);

    expect(response.status).toBe(200);
    expect(mocks.findApiKeyWorkspaceOnDirectory).toHaveBeenCalledWith("key-1", "workspace.read", "dir-1", [
      "ws-b",
      "ws-c",
    ]);
    const body = await response.json();
    expect(body.data).toStrictEqual({
      id: CONTACT_ID,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      workspaceId: "ws-a",
    });
  });

  test("GET answers 401 when the key reaches no workspace on the contact's directory", async () => {
    mocks.findApiKeyWorkspaceOnDirectory.mockResolvedValue(null);

    const { response } = await call(GET);

    expect(response.status).toBe(401);
  });

  test("GET answers 404 for a contact that does not exist", async () => {
    mocks.getContact.mockResolvedValue(null);

    const { response } = await call(GET);

    expect(response.status).toBe(404);
  });

  test("DELETE deletes within the authorized workspace's directory", async () => {
    const { response } = await call(DELETE);

    expect(response.status).toBe(200);
    expect(mocks.findApiKeyWorkspaceOnDirectory).toHaveBeenCalledWith("key-1", "workspace.manage", "dir-1", [
      "ws-b",
      "ws-c",
    ]);
    expect(mocks.deleteContactInWorkspace).toHaveBeenCalledWith(CONTACT_ID, "ws-b");
  });

  test("DELETE answers 403 in a shared directory", async () => {
    mocks.deleteContactInWorkspace.mockRejectedValue(new ContactInSharedDirectoryError());

    const { response } = await call(DELETE);

    expect(response.status).toBe(403);
    expect((await response.json()).message).toBe(new ContactInSharedDirectoryError().message);
  });

  test("DELETE deletes nothing when the key may not manage a workspace on the directory", async () => {
    mocks.findApiKeyWorkspaceOnDirectory.mockResolvedValue(null);

    const { response } = await call(DELETE);

    expect(response.status).toBe(401);
    expect(mocks.deleteContactInWorkspace).not.toHaveBeenCalled();
  });
});
