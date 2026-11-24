import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TSegment, TSegmentSurveyInteractionFilter } from "@formbricks/types/segment";
import { SurveyInteractionFilter } from "./survey-interaction-filter";

const mocks = vi.hoisted(() => ({
  listSegmentFilterSurveys: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../lib/api-client", () => ({
  getContactAttributeKeyValues: vi.fn(),
  listSegmentFilterSurveys: mocks.listSegmentFilterSurveys,
}));

vi.mock("@/app/(app)/workspaces/[workspaceId]/context/workspace-context", () => ({
  useWorkspace: () => ({ workspace: { id: "ws-b" } }),
}));

const ownSurveyId = "clownsurvey00000000000001";
const otherWorkspaceSurveyId = "clothersurvey000000000001";

const resource: TSegmentSurveyInteractionFilter = {
  id: "resource-1",
  root: { type: "surveyInteraction" },
  qualifier: { operator: "haveNotSeen" },
  value: {
    surveyScope: "specific",
    surveyIds: [ownSurveyId, otherWorkspaceSurveyId],
    within: { amount: 30, unit: "days" },
  },
};

// A shared segment made in workspace A, edited from workspace B of the same directory (decision 24).
const segment: TSegment = {
  id: "segment-1",
  title: "Shared",
  description: null,
  isPrivate: false,
  filters: [{ id: "filter-1", connector: null, resource }],
  workspaceId: "ws-a",
  createdAt: new Date(),
  updatedAt: new Date(),
  surveys: [],
};

const renderFilter = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SurveyInteractionFilter
        connector={null}
        onAddFilterBelow={vi.fn()}
        onCreateGroup={vi.fn()}
        onDeleteFilter={vi.fn()}
        onMoveFilter={vi.fn()}
        resource={resource}
        segment={segment}
        setSegment={vi.fn()}
      />
    </QueryClientProvider>
  );

describe("SurveyInteractionFilter", () => {
  beforeEach(() => {
    mocks.listSegmentFilterSurveys.mockResolvedValue({
      surveys: [{ id: ownSurveyId, name: "Onboarding survey", status: "inProgress" }],
      otherWorkspaceSurveyIds: [otherWorkspaceSurveyId],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("picks surveys from the workspace the editor is open in, not the segment's origin", async () => {
    renderFilter();

    await waitFor(() => {
      expect(mocks.listSegmentFilterSurveys).toHaveBeenCalledWith(
        "ws-b",
        [ownSurveyId, otherWorkspaceSurveyId],
        expect.anything()
      );
    });
  });

  test("shows a survey of another workspace under a fixed label, never its name or as missing", async () => {
    renderFilter();

    expect(await screen.findByText("Onboarding survey")).toBeInTheDocument();
    expect(await screen.findByText("workspace.segments.survey_in_another_workspace")).toBeInTheDocument();
  });
});
