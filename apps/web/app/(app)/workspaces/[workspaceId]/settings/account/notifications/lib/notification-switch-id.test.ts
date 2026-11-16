import { describe, expect, test } from "vitest";
import { getNotificationSwitchId } from "./notification-switch-id";

describe("getNotificationSwitchId", () => {
  test("gives every switch on the page its own id", () => {
    const ids = [
      getNotificationSwitchId("alert", "survey-a"),
      getNotificationSwitchId("alert", "survey-b"),
      // A survey and an organization could share an id string; the type keeps their switches apart.
      getNotificationSwitchId("unsubscribedOrganizationIds", "survey-a"),
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });
});
