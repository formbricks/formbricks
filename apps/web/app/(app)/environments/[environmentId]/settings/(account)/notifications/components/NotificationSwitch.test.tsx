import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TUserNotificationSettings } from "@formbricks/types/user";
import { updateNotificationSettingsAction } from "../actions";
import { NotificationSwitch } from "./NotificationSwitch";

vi.mock("@/modules/ui/components/switch", () => ({
  Switch: vi.fn(({ checked, disabled, onCheckedChange, id, "aria-label": ariaLabel }) => (
    <input
      type="checkbox"
      data-testid={id}
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      onChange={onCheckedChange}
    />
  )),
}));

vi.mock("../actions", () => ({
  updateNotificationSettingsAction: vi.fn(() => Promise.resolve()),
}));

const surveyId = "survey1";
const projectId = "project1";
const organizationId = "org1";

const baseNotificationSettings: TUserNotificationSettings = {
  alert: {},
  weeklySummary: {},
  unsubscribedOrganizationIds: [],
};

describe("NotificationSwitch", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderSwitch = (props: Partial<React.ComponentProps<typeof NotificationSwitch>>) => {
    const defaultProps: React.ComponentProps<typeof NotificationSwitch> = {
      surveyOrProjectOrOrganizationId: surveyId,
      notificationSettings: JSON.parse(JSON.stringify(baseNotificationSettings)),
      notificationType: "alert",
    };
    return render(<NotificationSwitch {...defaultProps} {...props} />);
  };

  test("renders with initial checked state for 'alert' (true)", () => {
    const settings = { ...baseNotificationSettings, alert: { [surveyId]: true } };
    renderSwitch({ notificationSettings: settings, notificationType: "alert" });
    const switchInput = screen.getByLabelText("toggle notification settings for alert") as HTMLInputElement;
    expect(switchInput.checked).toBe(true);
  });

  test("renders with initial checked state for 'alert' (false)", () => {
    const settings = { ...baseNotificationSettings, alert: { [surveyId]: false } };
    renderSwitch({ notificationSettings: settings, notificationType: "alert" });
    const switchInput = screen.getByLabelText("toggle notification settings for alert") as HTMLInputElement;
    expect(switchInput.checked).toBe(false);
  });

  test("renders with initial checked state for 'weeklySummary' (true)", () => {
    const settings = { ...baseNotificationSettings, weeklySummary: { [projectId]: true } };
    renderSwitch({
      surveyOrProjectOrOrganizationId: projectId,
      notificationSettings: settings,
      notificationType: "weeklySummary",
    });
    const switchInput = screen.getByLabelText(
      "toggle notification settings for weeklySummary"
    ) as HTMLInputElement;
    expect(switchInput.checked).toBe(true);
  });

  test("renders with initial checked state for 'unsubscribedOrganizationIds' (subscribed initially, so checked is true)", () => {
    const settings = { ...baseNotificationSettings, unsubscribedOrganizationIds: [] };
    renderSwitch({
      surveyOrProjectOrOrganizationId: organizationId,
      notificationSettings: settings,
      notificationType: "unsubscribedOrganizationIds",
    });
    const switchInput = screen.getByLabelText(
      "toggle notification settings for unsubscribedOrganizationIds"
    ) as HTMLInputElement;
    expect(switchInput.checked).toBe(true); // Not in unsubscribed list means subscribed
  });

  test("renders with initial checked state for 'unsubscribedOrganizationIds' (unsubscribed initially, so checked is false)", () => {
    const settings = { ...baseNotificationSettings, unsubscribedOrganizationIds: [organizationId] };
    renderSwitch({
      surveyOrProjectOrOrganizationId: organizationId,
      notificationSettings: settings,
      notificationType: "unsubscribedOrganizationIds",
    });
    const switchInput = screen.getByLabelText(
      "toggle notification settings for unsubscribedOrganizationIds"
    ) as HTMLInputElement;
    expect(switchInput.checked).toBe(false); // In unsubscribed list means unsubscribed
  });

  test("handles switch change for 'alert' type", async () => {
    const initialSettings = { ...baseNotificationSettings, alert: { [surveyId]: false } };
    renderSwitch({ notificationSettings: initialSettings, notificationType: "alert" });
    const switchInput = screen.getByLabelText("toggle notification settings for alert");

    await act(async () => {
      await user.click(switchInput);
    });

    expect(updateNotificationSettingsAction).toHaveBeenCalledWith({
      notificationSettings: { ...initialSettings, alert: { [surveyId]: true } },
    });
    expect(toast.success).toHaveBeenCalledWith(
      "environments.settings.notifications.notification_settings_updated",
      { id: "notification-switch" }
    );
    expect(switchInput).toBeEnabled(); // Check if not disabled after action
  });

  test("handles switch change for 'unsubscribedOrganizationIds' (subscribe)", async () => {
    const initialSettings = { ...baseNotificationSettings, unsubscribedOrganizationIds: [organizationId] }; // initially unsubscribed
    renderSwitch({
      surveyOrProjectOrOrganizationId: organizationId,
      notificationSettings: initialSettings,
      notificationType: "unsubscribedOrganizationIds",
    });
    const switchInput = screen.getByLabelText("toggle notification settings for unsubscribedOrganizationIds");

    await act(async () => {
      await user.click(switchInput);
    });

    expect(updateNotificationSettingsAction).toHaveBeenCalledWith({
      notificationSettings: { ...initialSettings, unsubscribedOrganizationIds: [] }, // should be removed from list
    });
    expect(toast.success).toHaveBeenCalledWith(
      "environments.settings.notifications.notification_settings_updated",
      { id: "notification-switch" }
    );
  });

  test("handles switch change for 'unsubscribedOrganizationIds' (unsubscribe)", async () => {
    const initialSettings = { ...baseNotificationSettings, unsubscribedOrganizationIds: [] }; // initially subscribed
    renderSwitch({
      surveyOrProjectOrOrganizationId: organizationId,
      notificationSettings: initialSettings,
      notificationType: "unsubscribedOrganizationIds",
    });
    const switchInput = screen.getByLabelText("toggle notification settings for unsubscribedOrganizationIds");

    await act(async () => {
      await user.click(switchInput);
    });

    expect(updateNotificationSettingsAction).toHaveBeenCalledWith({
      notificationSettings: { ...initialSettings, unsubscribedOrganizationIds: [organizationId] }, // should be added to list
    });
    expect(toast.success).toHaveBeenCalledWith(
      "environments.settings.notifications.notification_settings_updated",
      { id: "notification-switch" }
    );
  });

  test("useEffect: auto-disables 'alert' notification if conditions met", () => {
    const settings = { ...baseNotificationSettings, alert: { [surveyId]: true } }; // Initially true
    renderSwitch({
      surveyOrProjectOrOrganizationId: surveyId,
      notificationSettings: settings,
      notificationType: "alert",
      autoDisableNotificationType: "alert",
      autoDisableNotificationElementId: surveyId,
    });

    expect(updateNotificationSettingsAction).toHaveBeenCalledWith({
      notificationSettings: { ...settings, alert: { [surveyId]: false } },
    });
    expect(toast.success).toHaveBeenCalledWith(
      "environments.settings.notifications.you_will_not_receive_any_more_emails_for_responses_on_this_survey",
      { id: "notification-switch" }
    );
  });

  test("useEffect: auto-disables 'unsubscribedOrganizationIds' (auto-unsubscribes) if conditions met", () => {
    const settings = { ...baseNotificationSettings, unsubscribedOrganizationIds: [] }; // Initially subscribed
    renderSwitch({
      surveyOrProjectOrOrganizationId: organizationId,
      notificationSettings: settings,
      notificationType: "unsubscribedOrganizationIds",
      autoDisableNotificationType: "someOtherType", // This prop is used to trigger the effect, not directly for type matching in this case
      autoDisableNotificationElementId: organizationId,
    });

    expect(updateNotificationSettingsAction).toHaveBeenCalledWith({
      notificationSettings: { ...settings, unsubscribedOrganizationIds: [organizationId] },
    });
    expect(toast.success).toHaveBeenCalledWith(
      "environments.settings.notifications.you_will_not_be_auto_subscribed_to_this_organizations_surveys_anymore",
      { id: "notification-switch" }
    );
  });

  test("useEffect: does not auto-disable if 'autoDisableNotificationElementId' does not match", () => {
    const settings = { ...baseNotificationSettings, alert: { [surveyId]: true } };
    renderSwitch({
      surveyOrProjectOrOrganizationId: surveyId,
      notificationSettings: settings,
      notificationType: "alert",
      autoDisableNotificationType: "alert",
      autoDisableNotificationElementId: "otherId", // Mismatch
    });
    expect(updateNotificationSettingsAction).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalledWith(
      "environments.settings.notifications.you_will_not_receive_any_more_emails_for_responses_on_this_survey"
    );
  });

  test("useEffect: does not auto-disable if not checked initially for 'alert'", () => {
    const settings = { ...baseNotificationSettings, alert: { [surveyId]: false } }; // Initially false
    renderSwitch({
      surveyOrProjectOrOrganizationId: surveyId,
      notificationSettings: settings,
      notificationType: "alert",
      autoDisableNotificationType: "alert",
      autoDisableNotificationElementId: surveyId,
    });
    expect(updateNotificationSettingsAction).not.toHaveBeenCalled();
  });

  test("useEffect: does not auto-disable if not checked initially for 'unsubscribedOrganizationIds' (already unsubscribed)", () => {
    const settings = { ...baseNotificationSettings, unsubscribedOrganizationIds: [organizationId] }; // Initially unsubscribed
    renderSwitch({
      surveyOrProjectOrOrganizationId: organizationId,
      notificationSettings: settings,
      notificationType: "unsubscribedOrganizationIds",
      autoDisableNotificationType: "someType",
      autoDisableNotificationElementId: organizationId,
    });
    expect(updateNotificationSettingsAction).not.toHaveBeenCalled();
  });
});
