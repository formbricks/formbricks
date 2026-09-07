import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { createOrganization } from "@/lib/organization/service";
import { ensureCloudStripeSetupForOrganization } from "@/modules/ee/billing/lib/organization-billing";
import { createWorkspace } from "@/modules/workspaces/settings/lib/workspace";
import { ensureDefaultOrganization } from "./default-organization";

vi.mock("@formbricks/database", () => ({
  prisma: { organization: { findUnique: vi.fn() } },
}));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/organization/service", () => ({ createOrganization: vi.fn() }));
vi.mock("@/modules/ee/billing/lib/organization-billing", () => ({
  ensureCloudStripeSetupForOrganization: vi.fn(),
}));
vi.mock("@/modules/workspaces/settings/lib/workspace", () => ({ createWorkspace: vi.fn() }));

const constantsOverrides = vi.hoisted(() => ({
  DEFAULT_ORGANIZATION_ID: "default-org" as string | undefined,
  DEFAULT_ORGANIZATION_ROLE: undefined as string | undefined,
  IS_FORMBRICKS_CLOUD: false as boolean,
}));
vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    get DEFAULT_ORGANIZATION_ID() {
      return constantsOverrides.DEFAULT_ORGANIZATION_ID;
    },
    get DEFAULT_ORGANIZATION_ROLE() {
      return constantsOverrides.DEFAULT_ORGANIZATION_ROLE;
    },
    get IS_FORMBRICKS_CLOUD() {
      return constantsOverrides.IS_FORMBRICKS_CLOUD;
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  constantsOverrides.DEFAULT_ORGANIZATION_ID = "default-org";
  constantsOverrides.DEFAULT_ORGANIZATION_ROLE = undefined;
  constantsOverrides.IS_FORMBRICKS_CLOUD = false;
  vi.mocked(prisma.organization.findUnique).mockReset();
  vi.mocked(createOrganization).mockReset();
  vi.mocked(createWorkspace).mockResolvedValue({ id: "ws-1" } as never);
});

describe("ensureDefaultOrganization — existing organization", () => {
  beforeEach(() => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: "default-org" } as never);
  });

  test("assigns manager by default — the legacy role for an org that already existed", async () => {
    expect(await ensureDefaultOrganization("Ada")).toEqual({
      organizationId: "default-org",
      role: "manager",
    });
    expect(createOrganization).not.toHaveBeenCalled();
    expect(createWorkspace).not.toHaveBeenCalled();
  });

  test("honors DEFAULT_ORGANIZATION_ROLE when set", async () => {
    constantsOverrides.DEFAULT_ORGANIZATION_ROLE = "member";
    expect(await ensureDefaultOrganization("Ada")).toEqual({
      organizationId: "default-org",
      role: "member",
    });
  });
});

describe("ensureDefaultOrganization — creating the organization", () => {
  beforeEach(() => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
    vi.mocked(createOrganization).mockResolvedValue({ id: "default-org" } as never);
  });

  test("creates the org under the configured id, gives it a workspace, and makes the user owner", async () => {
    expect(await ensureDefaultOrganization("Ada")).toEqual({
      organizationId: "default-org",
      role: "owner",
    });
    expect(createOrganization).toHaveBeenCalledWith({
      id: "default-org",
      name: "Ada's Organization",
    });
    // v5 needs a workspace: an organization without one drops the user into an unusable instance.
    expect(createWorkspace).toHaveBeenCalledWith("default-org", { name: "My workspace" });
  });

  test("owner wins over DEFAULT_ORGANIZATION_ROLE, so the first user can administer the new org", async () => {
    constantsOverrides.DEFAULT_ORGANIZATION_ROLE = "member";
    expect(await ensureDefaultOrganization("Ada")).toMatchObject({ role: "owner" });
  });

  test("skips Stripe setup when not on Formbricks Cloud", async () => {
    await ensureDefaultOrganization("Ada");
    expect(ensureCloudStripeSetupForOrganization).not.toHaveBeenCalled();
  });

  test("runs Stripe setup on Formbricks Cloud", async () => {
    constantsOverrides.IS_FORMBRICKS_CLOUD = true;
    vi.mocked(ensureCloudStripeSetupForOrganization).mockResolvedValue(undefined as never);
    await ensureDefaultOrganization("Ada");
    expect(ensureCloudStripeSetupForOrganization).toHaveBeenCalledWith("default-org");
  });
});

describe("ensureDefaultOrganization — nothing to assign", () => {
  test("returns null when DEFAULT_ORGANIZATION_ID is unset, without touching the database", async () => {
    constantsOverrides.DEFAULT_ORGANIZATION_ID = undefined;
    expect(await ensureDefaultOrganization("Ada")).toBeNull();
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });

  test("returns null and logs when the id is unusable, e.g. not a cuid2", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
    vi.mocked(createOrganization).mockRejectedValue(new Error("Invalid organization id"));
    expect(await ensureDefaultOrganization("Ada")).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  test("never throws — the SSO user is already committed by the time this runs", async () => {
    vi.mocked(prisma.organization.findUnique).mockRejectedValue(new Error("db down"));
    await expect(ensureDefaultOrganization("Ada")).resolves.toBeNull();
  });
});

describe("ensureDefaultOrganization — concurrent first sign-up", () => {
  test("re-reads and assigns to the org the racing sign-up created, instead of giving up", async () => {
    vi.mocked(prisma.organization.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "default-org" } as never);
    vi.mocked(createOrganization).mockRejectedValue(new Error("Unique constraint failed"));

    expect(await ensureDefaultOrganization("Ada")).toEqual({
      organizationId: "default-org",
      role: "manager",
    });
    expect(logger.error).not.toHaveBeenCalled();
  });
});
