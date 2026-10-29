import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { createMembership } from "@/lib/membership/service";
import { createOrganization } from "@/lib/organization/service";
import { capturePostHogEvent, getEmailDomain, groupIdentifyPostHog } from "@/lib/posthog";
import { updateUser } from "@/modules/auth/lib/user";
import { ensureCloudStripeSetupForOrganization } from "@/modules/ee/billing/lib/organization-billing";
import { createOwnedOrganization } from "./owned-organization";

const constants = vi.hoisted(() => ({ IS_FORMBRICKS_CLOUD: false }));

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { organization: { delete: vi.fn() } } }));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get IS_FORMBRICKS_CLOUD() {
    return constants.IS_FORMBRICKS_CLOUD;
  },
}));
vi.mock("@/lib/membership/service", () => ({ createMembership: vi.fn() }));
vi.mock("@/lib/organization/service", () => ({ createOrganization: vi.fn() }));
vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
  groupIdentifyPostHog: vi.fn(),
  getEmailDomain: vi.fn(() => "example.com"),
}));
vi.mock("@/modules/auth/lib/user", () => ({ updateUser: vi.fn() }));
vi.mock("@/modules/ee/billing/lib/organization-billing", () => ({
  ensureCloudStripeSetupForOrganization: vi.fn(),
}));

const organizationId = "tz4a98xxat96iws9zmbrgj3a";
const user = {
  id: "user_1",
  name: "Ada",
  email: "ada@example.com",
  notificationSettings: { alert: { survey_1: true }, unsubscribedOrganizationIds: ["org_old"] },
} as never;
const signUp = { isFirstOrganization: true, unsubscribeFromNotifications: true } as const;

describe("createOwnedOrganization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    constants.IS_FORMBRICKS_CLOUD = false;
    vi.mocked(createOrganization).mockResolvedValue({
      id: organizationId,
      name: "Ada's Organization",
    } as never);
    vi.mocked(createMembership).mockResolvedValue({} as never);
    vi.mocked(ensureCloudStripeSetupForOrganization).mockResolvedValue(undefined as never);
    vi.mocked(getEmailDomain).mockReturnValue("example.com");
  });

  test("names the organization after the person by default and makes them its accepted owner", async () => {
    const organization = await createOwnedOrganization(user, signUp);

    expect(organization.id).toBe(organizationId);
    expect(createOrganization).toHaveBeenCalledExactlyOnceWith({ name: "Ada's Organization" });
    expect(createMembership).toHaveBeenCalledExactlyOnceWith(organizationId, "user_1", {
      role: "owner",
      accepted: true,
    });
  });

  test("an explicit name wins over the default", async () => {
    await createOwnedOrganization(user, { ...signUp, name: "Acme" });

    expect(createOrganization).toHaveBeenCalledExactlyOnceWith({ name: "Acme" });
  });

  test("self sign-up unsubscribes the person from the new organization's notifications, keeping the rest", async () => {
    await createOwnedOrganization(user, signUp);

    expect(updateUser).toHaveBeenCalledExactlyOnceWith("user_1", {
      notificationSettings: {
        alert: { survey_1: true },
        unsubscribedOrganizationIds: ["org_old", organizationId],
      },
    });
  });

  test("a caller that does not ask for it leaves notification settings alone", async () => {
    await createOwnedOrganization(user, { isFirstOrganization: false, unsubscribeFromNotifications: false });

    expect(updateUser).not.toHaveBeenCalled();
  });

  test("reports the caller's is_first_org, not a constant", async () => {
    await createOwnedOrganization(user, { isFirstOrganization: false, unsubscribeFromNotifications: false });

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      "user_1",
      "organization_created",
      { organization_id: organizationId, is_first_org: false },
      { organizationId }
    );
  });

  test("identifies the organization group in analytics, and a person without an email does not break it", async () => {
    await createOwnedOrganization(user, signUp);
    expect(groupIdentifyPostHog).toHaveBeenCalledWith("organization", organizationId, {
      name: "Ada's Organization",
      email_domain: "example.com",
    });

    await createOwnedOrganization({ id: "user_2" }, { ...signUp, name: "Acme" });
    expect(groupIdentifyPostHog).toHaveBeenLastCalledWith("organization", organizationId, {
      name: "Ada's Organization",
      email_domain: undefined,
    });
  });

  test("Stripe is set up only on Cloud, only after the membership exists, and a failure does not fail the call", async () => {
    await createOwnedOrganization(user, signUp);
    expect(ensureCloudStripeSetupForOrganization).not.toHaveBeenCalled();

    constants.IS_FORMBRICKS_CLOUD = true;
    vi.mocked(ensureCloudStripeSetupForOrganization).mockRejectedValue(new Error("stripe down"));
    await expect(createOwnedOrganization(user, signUp)).resolves.toBeDefined();

    expect(ensureCloudStripeSetupForOrganization).toHaveBeenCalledExactlyOnceWith(organizationId);
    const [membershipOrder] = vi.mocked(createMembership).mock.invocationCallOrder.slice(-1);
    const [stripeOrder] = vi.mocked(ensureCloudStripeSetupForOrganization).mock.invocationCallOrder;
    expect(membershipOrder).toBeLessThan(stripeOrder);
  });

  test("removes the ownerless organization when the owner membership fails, and rethrows the original error", async () => {
    const failure = new Error("database unavailable");
    vi.mocked(createMembership).mockRejectedValue(failure);
    vi.mocked(prisma.organization.delete).mockResolvedValue({} as never);

    await expect(createOwnedOrganization(user, signUp)).rejects.toBe(failure);

    expect(prisma.organization.delete).toHaveBeenCalledExactlyOnceWith({ where: { id: organizationId } });
    expect(ensureCloudStripeSetupForOrganization).not.toHaveBeenCalled();
    expect(capturePostHogEvent).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  test("a failed cleanup is logged and the original failure still wins", async () => {
    const failure = new Error("database unavailable");
    vi.mocked(createMembership).mockRejectedValue(failure);
    vi.mocked(prisma.organization.delete).mockRejectedValue(new Error("cannot delete"));

    await expect(createOwnedOrganization(user, signUp)).rejects.toBe(failure);

    expect(logger.error).toHaveBeenCalledOnce();
  });

  test("an organization that cannot be created writes no membership", async () => {
    vi.mocked(createOrganization).mockRejectedValue(new Error("database down"));

    await expect(createOwnedOrganization(user, signUp)).rejects.toThrow("database down");

    expect(createMembership).not.toHaveBeenCalled();
    expect(prisma.organization.delete).not.toHaveBeenCalled();
  });
});
