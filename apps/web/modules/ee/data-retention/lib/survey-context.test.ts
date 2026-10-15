import { beforeEach, describe, expect, test, vi } from "vitest";
import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { getIsDataRetentionEnabled } from "@/modules/ee/license-check/lib/utils";
import { getSurveyDataRetentionContext } from "./survey-context";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/authorization/context", () => ({
  withAuthorizationSurface: vi.fn((_surface: string, fn: () => unknown) => fn()),
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDataRetentionEnabled: vi.fn() }));

/** The licence and the permission check are proven in their own modules; this pins how a page uses them. */
describe("getSurveyDataRetentionContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("shows nothing of data retention without the licence", async () => {
    vi.mocked(getIsDataRetentionEnabled).mockResolvedValue(false);

    await expect(getSurveyDataRetentionContext({ id: "clorg" }, "cluser")).resolves.toBeNull();
    expect(can).not.toHaveBeenCalled();
  });

  test("states dates in the organisation's zone, and lets only those who manage it exempt the survey", async () => {
    vi.mocked(getIsDataRetentionEnabled).mockResolvedValue(true);
    vi.mocked(can).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(
      getSurveyDataRetentionContext({ id: "clorg", displayTimeZone: "Europe/Lisbon" }, "cluser")
    ).resolves.toEqual({ organizationId: "clorg", timeZone: "Europe/Lisbon", canExempt: true });
    await expect(getSurveyDataRetentionContext({ id: "clorg" }, "cluser")).resolves.toEqual({
      organizationId: "clorg",
      timeZone: "UTC",
      canExempt: false,
    });

    expect(withAuthorizationSurface).toHaveBeenCalledWith("page", expect.any(Function));
    expect(can).toHaveBeenCalledWith({ type: "user", id: "cluser" }, "organization.manage", {
      type: "organization",
      id: "clorg",
    });
  });
});
