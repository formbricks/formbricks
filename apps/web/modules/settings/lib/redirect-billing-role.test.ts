import { redirect } from "next/navigation";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { can } from "@/lib/authorization";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { redirectBillingRoleFromRestrictedOrgSettings } from "./redirect-billing-role";
import { getOrganizationBillingPath } from "./routes";

vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/modules/organization/lib/utils", () => ({ getOrganizationAuth: vi.fn() }));

const ORGANIZATION_ID = "org-1";
const USER_ID = "user-1";

describe("redirectBillingRoleFromRestrictedOrgSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrganizationAuth).mockResolvedValue({
      session: { user: { id: USER_ID }, expires: new Date().toISOString() },
    } as Awaited<ReturnType<typeof getOrganizationAuth>>);
  });

  test("lets centrally authorized users through to the settings page", async () => {
    vi.mocked(can).mockResolvedValue(true);

    await redirectBillingRoleFromRestrictedOrgSettings(ORGANIZATION_ID);

    expect(can).toHaveBeenCalledExactlyOnceWith({ type: "user", id: USER_ID }, "organization.read_access", {
      type: "organization",
      id: ORGANIZATION_ID,
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  test("redirects users denied by the central authorization interface", async () => {
    vi.mocked(can).mockResolvedValue(false);

    await redirectBillingRoleFromRestrictedOrgSettings(ORGANIZATION_ID);

    // `redirect` is globally mocked and does not throw (vitestSetup.ts), so assert on the call.
    expect(redirect).toHaveBeenCalledExactlyOnceWith(getOrganizationBillingPath(ORGANIZATION_ID, false));
  });

  test("propagates central authorization operational failures", async () => {
    const operationalError = new Error("authorization unavailable");
    vi.mocked(can).mockRejectedValue(operationalError);

    await expect(redirectBillingRoleFromRestrictedOrgSettings(ORGANIZATION_ID)).rejects.toBe(
      operationalError
    );
    expect(redirect).not.toHaveBeenCalled();
  });
});
