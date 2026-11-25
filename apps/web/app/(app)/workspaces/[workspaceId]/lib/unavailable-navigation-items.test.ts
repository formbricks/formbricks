import { beforeEach, describe, expect, test, vi } from "vitest";
import { NO_HIDDEN_NAVIGATION_ITEMS, getHiddenNavigationItems } from "./unavailable-navigation-items";

const mocks = vi.hoisted(() => ({
  getIsWorkflowsEnabled: vi.fn(),
  getIsFeedbackDirectoriesEnabled: vi.fn(),
  getIsContactsEnabled: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsWorkflowsEnabled: mocks.getIsWorkflowsEnabled,
  getIsFeedbackDirectoriesEnabled: mocks.getIsFeedbackDirectoriesEnabled,
  getIsContactsEnabled: mocks.getIsContactsEnabled,
}));

const ORG_ID = "clorg11111111111111111111";

const entitle = ({ workflows = true, feedbackDirectories = true, contacts = true } = {}) => {
  mocks.getIsWorkflowsEnabled.mockResolvedValue(workflows);
  mocks.getIsFeedbackDirectoriesEnabled.mockResolvedValue(feedbackDirectories);
  mocks.getIsContactsEnabled.mockResolvedValue(contacts);
};

describe("getHiddenNavigationItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entitle();
  });

  test("hides nothing, and checks no licence, while the organization keeps the setting off", async () => {
    entitle({ workflows: false, feedbackDirectories: false, contacts: false });

    expect(await getHiddenNavigationItems({ id: ORG_ID, hideUnavailableFeatures: false })).toEqual(
      NO_HIDDEN_NAVIGATION_ITEMS
    );
    expect(mocks.getIsWorkflowsEnabled).not.toHaveBeenCalled();
    expect(mocks.getIsFeedbackDirectoriesEnabled).not.toHaveBeenCalled();
    expect(mocks.getIsContactsEnabled).not.toHaveBeenCalled();
  });

  test("hides nothing when the setting is on and the plan includes every feature", async () => {
    expect(await getHiddenNavigationItems({ id: ORG_ID, hideUnavailableFeatures: true })).toEqual({
      workflows: false,
      feedbackData: false,
      contacts: false,
    });
    expect(mocks.getIsWorkflowsEnabled).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.getIsFeedbackDirectoriesEnabled).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.getIsContactsEnabled).toHaveBeenCalledWith(ORG_ID);
  });

  test.each([
    ["Workflows", { workflows: false }, { workflows: true, feedbackData: false, contacts: false }],
    [
      "Feedback Data",
      { feedbackDirectories: false },
      { workflows: false, feedbackData: true, contacts: false },
    ],
    ["Contacts", { contacts: false }, { workflows: false, feedbackData: false, contacts: true }],
  ])("hides only %s when the setting is on and the plan lacks it", async (_label, entitlements, expected) => {
    entitle(entitlements);

    expect(await getHiddenNavigationItems({ id: ORG_ID, hideUnavailableFeatures: true })).toEqual(expected);
  });

  test("hides all three when the setting is on and the plan lacks all of them", async () => {
    entitle({ workflows: false, feedbackDirectories: false, contacts: false });

    expect(await getHiddenNavigationItems({ id: ORG_ID, hideUnavailableFeatures: true })).toEqual({
      workflows: true,
      feedbackData: true,
      contacts: true,
    });
  });
});
