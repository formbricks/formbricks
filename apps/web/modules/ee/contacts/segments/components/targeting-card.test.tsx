import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TSegment } from "@formbricks/types/segment";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { TargetingCard } from "./targeting-card";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ i18nKey }: Readonly<{ i18nKey: string }>) => <span>{i18nKey}</span>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(app)/workspaces/[workspaceId]/context/workspace-context", () => ({
  useWorkspace: () => ({ workspace: { id: "ws-1" } }),
}));
vi.mock("@/modules/ee/contacts/segments/lib/api-client", () => ({
  attachSurveySegment: vi.fn(),
  copySegment: vi.fn(),
  createSegment: vi.fn(),
  resetSurveySegment: vi.fn(),
  updateSegment: vi.fn(),
}));
// Only the warning is under test; the editors and dialogs are stubs.
vi.mock("./segment-editor", () => ({ SegmentEditor: () => null }));
vi.mock("./add-filter-modal", () => ({ AddFilterModal: () => null }));
vi.mock("@/modules/ui/components/load-segment-modal", () => ({ LoadSegmentModal: () => null }));
vi.mock("@/modules/ui/components/save-as-new-segment-modal", () => ({ SaveAsNewSegmentModal: () => null }));
vi.mock("@/modules/ui/components/targeting-indicator", () => ({ TargetingIndicator: () => null }));

const segment = {
  id: "seg-old",
  title: "Power users",
  description: null,
  isPrivate: false,
  filters: [
    {
      id: "f1",
      connector: null,
      resource: {
        id: "r1",
        root: { type: "attribute", contactAttributeKey: "plan" },
        qualifier: { operator: "equals" },
        value: "pro",
      },
    },
  ],
  workspaceId: "ws-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  surveys: ["survey-1"],
} as TSegment;

const renderCard = (otherDirectorySegmentId: string | null) =>
  render(
    <TargetingCard
      localSurvey={{ id: "survey-1", workspaceId: "ws-1", type: "app", segment } as unknown as TSurvey}
      setLocalSurvey={vi.fn()}
      contactAttributeKeys={[]}
      segments={[]}
      otherDirectorySegmentId={otherDirectorySegmentId}
      sharedSegmentEdit={null}
      setSharedSegmentEdit={vi.fn()}
    />
  );

describe("TargetingCard › segment from another contact directory", () => {
  afterEach(cleanup);

  test("asks for new targeting while the survey's segment is from another directory", () => {
    renderCard("seg-old");

    expect(screen.getByText("workspace.segments.segment_from_another_contact_directory")).toBeInTheDocument();
  });

  test("shows no warning for a segment of the workspace's directory", () => {
    renderCard(null);

    expect(
      screen.queryByText("workspace.segments.segment_from_another_contact_directory")
    ).not.toBeInTheDocument();
  });
});
