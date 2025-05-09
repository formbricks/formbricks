import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { redirect } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TMembership } from "@formbricks/types/memberships";
import { TOrganization, TOrganizationBilling } from "@formbricks/types/organizations";
import EnvironmentPage from "./page";

vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));

vi.mock("@/lib/membership/utils", () => ({
  getAccessFlags: vi.fn(),
}));

vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("EnvironmentPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockEnvironmentId = "test-environment-id";
  const mockUserId = "test-user-id";
  const mockOrganizationId = "test-organization-id";

  const mockSession = {
    user: {
      id: mockUserId,
      name: "Test User",
      email: "test@example.com",
      imageUrl: "",
      twoFactorEnabled: false,
      identityProvider: "email",
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: new Date(),
      role: "user",
      objective: "other",
    },
    expires: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour from now
  } as any;

  const mockOrganization: TOrganization = {
    id: mockOrganizationId,
    name: "Test Organization",
    createdAt: new Date(),
    updatedAt: new Date(),
    billing: {
      stripeCustomerId: "cus_123",
    } as unknown as TOrganizationBilling,
  } as unknown as TOrganization;

  test("should redirect to billing settings if isBilling is true", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      session: mockSession,
      organization: mockOrganization,
      environment: { id: mockEnvironmentId, type: "production", product: { id: "prodId" } },
    } as any); // Using 'any' for brevity as environment type is complex and not core to this test

    const mockMembership: TMembership = {
      userId: mockUserId,
      organizationId: mockOrganizationId,
      role: "owner" as any,
      accepted: true,
    };
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);
    vi.mocked(getAccessFlags).mockReturnValue({ isBilling: true, isOwner: true } as any);

    await EnvironmentPage({ params: { environmentId: mockEnvironmentId } });

    expect(redirect).toHaveBeenCalledWith(`/environments/${mockEnvironmentId}/settings/billing`);
  });

  test("should redirect to surveys if isBilling is false", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      session: mockSession,
      organization: mockOrganization,
      environment: { id: mockEnvironmentId, type: "production", product: { id: "prodId" } },
    } as any);

    const mockMembership: TMembership = {
      userId: mockUserId,
      organizationId: mockOrganizationId,
      role: "developer" as any, // Role that would result in isBilling: false
      accepted: true,
    };
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);
    vi.mocked(getAccessFlags).mockReturnValue({ isBilling: false, isOwner: false } as any);

    await EnvironmentPage({ params: { environmentId: mockEnvironmentId } });

    expect(redirect).toHaveBeenCalledWith(`/environments/${mockEnvironmentId}/surveys`);
  });

  test("should handle session being null", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      session: null, // Simulate no active session
      organization: mockOrganization,
      environment: { id: mockEnvironmentId, type: "production", product: { id: "prodId" } },
    } as any);

    // Membership fetch might return null or throw, depending on implementation when userId is undefined
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);
    // Access flags would likely be all false if membership is null
    vi.mocked(getAccessFlags).mockReturnValue({ isBilling: false, isOwner: false } as any);

    await EnvironmentPage({ params: { environmentId: mockEnvironmentId } });

    // Expect redirect to surveys as default when isBilling is false
    expect(redirect).toHaveBeenCalledWith(`/environments/${mockEnvironmentId}/surveys`);
  });

  test("should handle currentUserMembership being null", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      session: mockSession,
      organization: mockOrganization,
      environment: { id: mockEnvironmentId, type: "production", product: { id: "prodId" } },
    } as any);

    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null); // Simulate no membership found
    // Access flags would likely be all false if membership is null
    vi.mocked(getAccessFlags).mockReturnValue({ isBilling: false, isOwner: false } as any);

    await EnvironmentPage({ params: { environmentId: mockEnvironmentId } });

    // Expect redirect to surveys as default when isBilling is false
    expect(redirect).toHaveBeenCalledWith(`/environments/${mockEnvironmentId}/surveys`);
  });
});
