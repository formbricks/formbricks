import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TUserNotificationSettings } from "@formbricks/types/user";
import { NotificationSwitch } from "./NotificationSwitch";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../actions", () => ({ updateNotificationSettingsAction: vi.fn() }));

const notificationSettings: TUserNotificationSettings = {
  alert: { "survey-a": true, "survey-b": false },
  unsubscribedOrganizationIds: [],
};

describe("NotificationSwitch", () => {
  afterEach(() => {
    cleanup();
  });

  test("gives every switch on the page its own id", () => {
    render(
      <>
        <NotificationSwitch
          surveyOrWorkspaceOrOrganizationId="survey-a"
          notificationSettings={notificationSettings}
          notificationType="alert"
        />
        <NotificationSwitch
          surveyOrWorkspaceOrOrganizationId="survey-b"
          notificationSettings={notificationSettings}
          notificationType="alert"
        />
        <NotificationSwitch
          surveyOrWorkspaceOrOrganizationId="survey-a"
          notificationSettings={notificationSettings}
          notificationType="unsubscribedOrganizationIds"
        />
      </>
    );

    const ids = screen.getAllByRole("switch").map((element) => element.id);

    expect(ids).toHaveLength(3);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
