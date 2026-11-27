import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  applyNotificationToggle,
  completeNotificationSettings,
  updateNotificationSetting,
} from "./notification-settings";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), updateUser: vi.fn(), findMany: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { membership: { findMany: mocks.findMany } } }));
vi.mock("@/lib/user/service", () => ({ getUser: mocks.getUser, updateUser: mocks.updateUser }));
vi.mock("@/lib/survey/visibility/predicate", () => ({
  buildVisibleSurveyWhereAcrossOrganizations: vi.fn(() => ({})),
}));

const membership = (surveyIds: string[]) => ({
  organization: {
    id: "org1",
    name: "Org",
    workspaces: [{ id: "ws1", name: "WS", surveys: surveyIds.map((id) => ({ id, name: id })) }],
  },
});

describe("completeNotificationSettings", () => {
  test("gives every visible survey a value: stored, legacy, or off", () => {
    const stored = {
      alert: { s1: true },
      // Settings from before the `alert` key existed kept a per-survey object.
      s2: { responseFinished: true },
      unsubscribedOrganizationIds: ["org9"],
    } as never;

    expect(completeNotificationSettings(stored, [membership(["s1", "s2", "s3"])])).toEqual({
      alert: { s1: true, s2: true, s3: false },
      unsubscribedOrganizationIds: ["org9"],
    });
  });

  test("drops alerts for surveys the user no longer sees", () => {
    expect(completeNotificationSettings({ alert: { gone: true } }, [membership(["s1"])]).alert).toEqual({
      s1: false,
    });
  });
});

describe("applyNotificationToggle", () => {
  const settings = { alert: { s1: true, s2: false }, unsubscribedOrganizationIds: ["org1"] };

  test("flips one survey alert and leaves the others alone", () => {
    expect(applyNotificationToggle(settings, { type: "alert", surveyId: "s2", enabled: true })).toEqual({
      alert: { s1: true, s2: true },
      unsubscribedOrganizationIds: ["org1"],
    });
  });

  test("resubscribes and unsubscribes an organization without duplicates", () => {
    expect(
      applyNotificationToggle(settings, {
        type: "organizationEmails",
        organizationId: "org1",
        subscribed: true,
      }).unsubscribedOrganizationIds
    ).toEqual([]);
    expect(
      applyNotificationToggle(settings, {
        type: "organizationEmails",
        organizationId: "org1",
        subscribed: false,
      }).unsubscribedOrganizationIds
    ).toEqual(["org1"]);
    expect(
      applyNotificationToggle(settings, {
        type: "organizationEmails",
        organizationId: "org2",
        subscribed: false,
      }).unsubscribedOrganizationIds
    ).toEqual(["org1", "org2"]);
  });

  test("does not mutate its input", () => {
    const frozen = structuredClone(settings);
    applyNotificationToggle(settings, { type: "alert", surveyId: "s1", enabled: false });
    expect(settings).toEqual(frozen);
  });
});

describe("updateNotificationSetting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([membership(["s1", "s2"])]);
  });

  test("applies the toggle to the stored, completed settings, and reports what was stored before", async () => {
    mocks.getUser.mockResolvedValue({ id: "u1", notificationSettings: { alert: { s1: true } } });

    const result = await updateNotificationSetting("u1", { type: "alert", surveyId: "s2", enabled: true });

    const after = { alert: { s1: true, s2: true }, unsubscribedOrganizationIds: [] };
    // `before` is the stored value as it was, not the completed view: the audit log records what changed.
    expect(result).toEqual({ before: { alert: { s1: true } }, after });
    expect(mocks.updateUser).toHaveBeenCalledWith("u1", { notificationSettings: after });
  });

  test("returns null and writes nothing for a user that no longer exists", async () => {
    mocks.getUser.mockResolvedValue(null);

    expect(
      await updateNotificationSetting("u1", { type: "alert", surveyId: "s1", enabled: false })
    ).toBeNull();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
