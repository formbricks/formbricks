import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getIsContactsEnabled: vi.fn(),
  getWorkspaceContactDirectory: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/lib/contact-directory", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/contacts/lib/contact-directory")>()),
  getWorkspaceContactDirectory: mocks.getWorkspaceContactDirectory,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsContactsEnabled: mocks.getIsContactsEnabled,
}));

const { checkContactDirectoryApiV2, checkContactsEnabledApiV2 } = await import("./contacts-api-guard");

describe("checkContactsEnabledApiV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns a forbidden error object when the entitlement is missing", async () => {
    mocks.getIsContactsEnabled.mockResolvedValue(false);

    const error = await checkContactsEnabledApiV2("org1");

    expect(error).toEqual({
      type: "forbidden",
      details: [{ field: "contacts", issue: "Contacts feature is not enabled for this organization" }],
    });
    expect(mocks.getIsContactsEnabled).toHaveBeenCalledWith("org1");
  });

  test("returns null when the entitlement is present", async () => {
    mocks.getIsContactsEnabled.mockResolvedValue(true);

    await expect(checkContactsEnabledApiV2("org1")).resolves.toBeNull();
  });
});

describe("checkContactDirectoryApiV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns a forbidden error with the no-directory message when the workspace has no directory", async () => {
    mocks.getWorkspaceContactDirectory.mockResolvedValue(null);

    await expect(checkContactDirectoryApiV2("ws1")).resolves.toEqual({
      type: "forbidden",
      message:
        "A contact directory needs to be set up for this workspace before contacts are available. Ask an organization owner or manager to assign one.",
    });
    expect(mocks.getWorkspaceContactDirectory).toHaveBeenCalledWith("ws1");
  });

  test("returns null when the workspace has a directory", async () => {
    mocks.getWorkspaceContactDirectory.mockResolvedValue({ id: "dir1", matchingKey: "email" });

    await expect(checkContactDirectoryApiV2("ws1")).resolves.toBeNull();
  });
});
