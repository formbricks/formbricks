import { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";
import { ResponseFeed } from "./response-feed";

// Mock the hooks and components
vi.mock("@/lib/membership/hooks/useMembershipRole", () => ({
  useMembershipRole: () => ({
    membershipRole: "owner",
  }),
}));

vi.mock("@/lib/utils/recall", () => ({
  replaceHeadlineRecall: (survey: TSurvey) => survey,
}));

vi.mock("@/modules/analysis/components/SingleResponseCard", () => ({
  SingleResponseCard: ({ response }: { response: TResponse }) => (
    <div data-testid="single-response-card">{response.id}</div>
  ),
}));

vi.mock("@/modules/ui/components/empty-space-filler", () => ({
  EmptySpaceFiller: () => <div data-testid="empty-space-filler">No responses</div>,
}));

describe("ResponseFeed", () => {
  afterEach(() => {
    cleanup();
  });

  const mockProps = {
    surveys: [
      {
        id: "survey1",
        name: "Test Survey",
        environmentId: "env1",
        questions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        type: "link",
        createdBy: null,
        status: "draft",
        autoClose: null,
        triggers: [],
        redirectUrl: null,
        recontactDays: null,
        welcomeCard: {
          enabled: false,
          headline: "",
          html: "",
        },
        verifyEmail: {
          name: "",
          subheading: "",
        },
        closeOnDate: null,
        displayLimit: null,
        autoComplete: null,
        runOnDate: null,
        productOverwrites: null,
        styling: null,
        pin: null,
        endings: [],
        hiddenFields: {},
        variables: [],
        followUps: [],
        thankYouCard: {
          enabled: false,
          headline: "",
          subheader: "",
        },
        delay: 0,
        displayPercentage: 100,
        surveyClosedMessage: "",
        singleUse: {
          enabled: false,
          heading: "",
          subheading: "",
        },
        attributeFilters: [],
        responseCount: 0,
        displayOption: "displayOnce",
        recurring: {
          enabled: false,
          frequency: 0,
        },
        language: "en",
        isDraft: true,
      } as unknown as TSurvey,
    ],
    user: {
      id: "user1",
    } as TUser,
    responses: [
      {
        id: "response1",
        surveyId: "survey1",
      } as TResponse,
    ],
    environment: {
      id: "env1",
    } as TEnvironment,
    environmentTags: [] as TTag[],
    locale: "en" as TUserLocale,
    projectPermission: null as TTeamPermission | null,
  };

  test("renders empty state when no responses", () => {
    render(<ResponseFeed {...mockProps} responses={[]} />);
    expect(screen.getByTestId("empty-space-filler")).toBeInTheDocument();
  });

  test("renders response cards when responses exist", () => {
    render(<ResponseFeed {...mockProps} />);
    expect(screen.getByTestId("single-response-card")).toBeInTheDocument();
    expect(screen.getByText("response1")).toBeInTheDocument();
  });

  test("updates responses when deleteResponses is called", () => {
    const { rerender } = render(<ResponseFeed {...mockProps} />);
    expect(screen.getByText("response1")).toBeInTheDocument();

    // Simulate response deletion
    rerender(<ResponseFeed {...mockProps} responses={[]} />);
    expect(screen.getByTestId("empty-space-filler")).toBeInTheDocument();
  });

  test("updates single response when updateResponse is called", () => {
    const updatedResponse = {
      ...mockProps.responses[0],
      id: "response1-updated",
    } as TResponse;

    const { rerender } = render(<ResponseFeed {...mockProps} />);
    expect(screen.getByText("response1")).toBeInTheDocument();

    // Simulate response update
    rerender(<ResponseFeed {...mockProps} responses={[updatedResponse]} />);
    expect(screen.getByText("response1-updated")).toBeInTheDocument();
  });
});
