import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { SettingsView } from "./settings-view";

// Only which Target audience card shows is under test; every card is a stub.
vi.mock("@/modules/ee/contacts/segments/components/targeting-card", () => ({
  TargetingCard: () => <div>targeting-card</div>,
}));
vi.mock("@/modules/survey/editor/components/targeting-locked-card", () => ({
  TargetingLockedCard: () => <div>targeting-locked-card</div>,
}));
vi.mock("@/modules/survey/editor/components/targeting-no-directory-card", () => ({
  TargetingNoDirectoryCard: () => <div>targeting-no-directory-card</div>,
}));
vi.mock("@/modules/survey/editor/components/how-to-send-card", () => ({ HowToSendCard: () => null }));
vi.mock("@/modules/survey/editor/components/when-to-send-card", () => ({ WhenToSendCard: () => null }));
vi.mock("@/modules/ee/quotas/components/quotas-card", () => ({ QuotasCard: () => null }));
vi.mock("@/modules/survey/editor/components/response-options-card", () => ({
  ResponseOptionsCard: () => null,
}));
vi.mock("@/modules/survey/editor/components/recontact-options-card", () => ({
  RecontactOptionsCard: () => null,
}));
vi.mock("@/modules/survey/editor/components/survey-placement-card", () => ({
  SurveyPlacementCard: () => null,
}));
vi.mock("@/modules/ee/data-retention/components/survey/survey-retention-card", () => ({
  SurveyRetentionCard: () => null,
}));
vi.mock("@/modules/ee/creatives/lib/survey-side", () => ({ getCreativeOpenedMode: () => null }));

const renderView = (props: {
  type: TSurvey["type"];
  isUserTargetingAllowed: boolean;
  hasContactDirectory: boolean;
}) =>
  render(
    <SettingsView
      {...({
        localSurvey: {
          id: "survey-1",
          workspaceId: "ws-1",
          type: props.type,
          segment: null,
        } as unknown as TSurvey,
        setLocalSurvey: vi.fn(),
        actionClasses: [],
        contactAttributeKeys: [],
        segments: [],
        responseCount: 0,
        finishedResponseCount: 0,
        membershipRole: "owner",
        isUserTargetingAllowed: props.isUserTargetingAllowed,
        hasContactDirectory: props.hasContactDirectory,
        isSpamProtectionAllowed: false,
        workspacePermission: null,
        isFormbricksCloud: false,
        isQuotasAllowed: false,
        quotas: [],
        surveySchedulingConfig: {},
        locale: "en-US",
        appSetupCompleted: true,
        enterpriseLicenseRequestFormUrl: "https://example.com",
        linkedCreatives: [],
        sharedSegmentEdit: null,
        setSharedSegmentEdit: vi.fn(),
      } as unknown as Parameters<typeof SettingsView>[0])}
    />
  );

describe("SettingsView › Target audience", () => {
  afterEach(cleanup);

  // Decision 13: a workspace with no contact directory has no contacts, so filters would match nobody.
  test("shows the no-directory card, not the filters, when the workspace has no directory", () => {
    renderView({ type: "app", isUserTargetingAllowed: true, hasContactDirectory: false });

    expect(screen.getByText("targeting-no-directory-card")).toBeInTheDocument();
    expect(screen.queryByText("targeting-card")).not.toBeInTheDocument();
  });

  test("shows the filters when the workspace has a directory", () => {
    renderView({ type: "app", isUserTargetingAllowed: true, hasContactDirectory: true });

    expect(screen.getByText("targeting-card")).toBeInTheDocument();
    expect(screen.queryByText("targeting-no-directory-card")).not.toBeInTheDocument();
  });

  test("shows the upgrade card without the licence, directory or not", () => {
    renderView({ type: "app", isUserTargetingAllowed: false, hasContactDirectory: false });

    expect(screen.getByText("targeting-locked-card")).toBeInTheDocument();
    expect(screen.queryByText("targeting-no-directory-card")).not.toBeInTheDocument();
  });

  test("shows no Target audience card for a link survey", () => {
    renderView({ type: "link", isUserTargetingAllowed: true, hasContactDirectory: false });

    expect(screen.queryByText("targeting-no-directory-card")).not.toBeInTheDocument();
    expect(screen.queryByText("targeting-card")).not.toBeInTheDocument();
  });
});
