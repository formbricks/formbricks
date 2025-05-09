import { getDefaultEndingCard } from "@/app/lib/survey-builder";
import { Environment } from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TLanguage } from "@formbricks/types/project";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey, TSurveyLanguage } from "@formbricks/types/surveys/types";
import { HowToSendCard } from "./how-to-send-card";

// Mock constants
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  ENCRYPTION_KEY: "test",
  ENTERPRISE_LICENSE_KEY: "test",
}));

// Mock auto-animate
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

// Mock getDefaultEndingCard
vi.mock("@/app/lib/survey-builder", () => ({
  getDefaultEndingCard: vi.fn(() => ({
    id: "test-id",
    type: "endScreen",
    headline: "Test Headline",
    subheader: "Test Subheader",
    buttonLabel: "Test Button",
    buttonLink: "https://formbricks.com",
  })),
}));

describe("HowToSendCard", () => {
  const mockSetLocalSurvey = vi.fn();

  const mockSurvey: Partial<TSurvey> = {
    id: "survey-123",
    type: "app",
    name: "Test Survey",
    languages: [
      {
        language: { code: "en" } as unknown as TLanguage,
      } as unknown as TSurveyLanguage,
    ],
    endings: [],
  };

  const mockEnvironment: Pick<Environment, "id" | "appSetupCompleted"> = {
    id: "env-123",
    appSetupCompleted: true,
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("initializes appSetupCompleted state to true when environment.appSetupCompleted is true", async () => {
    // Create environment with appSetupCompleted set to true
    const mockEnvironment: Pick<Environment, "id" | "appSetupCompleted"> = {
      id: "env-123",
      appSetupCompleted: true,
    };

    render(
      <HowToSendCard
        localSurvey={mockSurvey as TSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        environment={mockEnvironment}
      />
    );

    // Open the collapsible to see the content
    const trigger = screen.getByText("common.survey_type");
    await userEvent.click(trigger);

    // When appSetupCompleted is true, the alert should not be shown for the "app" option
    const appOption = screen.getByText("common.website_app_survey");
    expect(appOption).toBeInTheDocument();

    // The alert should not be present since appSetupCompleted is true
    const alertElement = screen.queryByText("environments.surveys.edit.formbricks_sdk_is_not_connected");
    expect(alertElement).not.toBeInTheDocument();
  });

  test("initializes appSetupCompleted state to false when environment.appSetupCompleted is false", async () => {
    // Create environment with appSetupCompleted set to false
    const mockEnvironment: Pick<Environment, "id" | "appSetupCompleted"> = {
      id: "env-123",
      appSetupCompleted: false,
    };

    render(
      <HowToSendCard
        localSurvey={mockSurvey as TSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        environment={mockEnvironment}
      />
    );

    // Open the collapsible to see the content
    const trigger = screen.getByText("common.survey_type");
    await userEvent.click(trigger);

    // When appSetupCompleted is false, the alert should be shown for the "app" option
    const appOption = screen.getByText("common.website_app_survey");
    expect(appOption).toBeInTheDocument();

    // The alert should be present since appSetupCompleted is false
    const alertElement = screen.getByText("environments.surveys.edit.formbricks_sdk_is_not_connected");
    expect(alertElement).toBeInTheDocument();
  });

  test("removes temporary segment when survey type is changed from 'app' to another type", async () => {
    // Create a temporary segment
    const tempSegment: TSegment = {
      id: "temp",
      isPrivate: true,
      title: "survey-123",
      environmentId: "env-123",
      surveys: ["survey-123"],
      filters: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      description: "",
    };

    // Create a mock survey with type 'app' and the temporary segment
    const mockSurveyWithSegment: Partial<TSurvey> = {
      id: "survey-123",
      type: "app",
      name: "Test Survey",
      languages: [
        {
          language: { code: "en" } as unknown as TLanguage,
        } as unknown as TSurveyLanguage,
      ],
      endings: [],
      segment: tempSegment,
    };

    render(
      <HowToSendCard
        localSurvey={mockSurveyWithSegment as TSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        environment={mockEnvironment}
      />
    );

    // Open the collapsible to see the content
    const trigger = screen.getByText("common.survey_type");
    await userEvent.click(trigger);

    // Find and click the 'link' radio button by finding its label first
    const linkLabel = screen.getByText("common.link_survey").closest("label");
    await userEvent.click(linkLabel!);

    // Verify that setLocalSurvey was called with a function that sets segment to null
    // We need to find the specific call that handles segment removal
    let segmentRemovalCalled = false;

    for (const call of mockSetLocalSurvey.mock.calls) {
      const setLocalSurveyFn = call[0];
      if (typeof setLocalSurveyFn === "function") {
        const result = setLocalSurveyFn(mockSurveyWithSegment as TSurvey);
        // If this call handles segment removal, the result should have segment set to null
        if (result.segment === null) {
          segmentRemovalCalled = true;
          break;
        }
      }
    }

    expect(segmentRemovalCalled).toBe(true);
  });

  test("allows changing survey type when survey status is 'draft'", async () => {
    // Create a survey with 'draft' status
    const draftSurvey: Partial<TSurvey> = {
      id: "survey-123",
      type: "link", // Current type is 'link'
      name: "Test Survey",
      languages: [
        {
          language: { code: "en" } as unknown as TLanguage,
        } as unknown as TSurveyLanguage,
      ],
      endings: [],
      status: "draft", // Survey is in draft mode
    };

    render(
      <HowToSendCard
        localSurvey={draftSurvey as TSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        environment={mockEnvironment as Environment}
      />
    );

    // Open the collapsible to see the content
    const trigger = screen.getByText("common.survey_type");
    await userEvent.click(trigger);

    // Try to change the survey type from 'link' to 'app'
    const appOption = screen.getByRole("radio", {
      name: "common.website_app_survey environments.surveys.edit.app_survey_description",
    });
    await userEvent.click(appOption);

    // Verify that setLocalSurvey was called, indicating the type change was allowed
    expect(mockSetLocalSurvey).toHaveBeenCalled();
  });

  test("currently allows changing survey type when survey status is 'inProgress'", async () => {
    // Create a survey with 'inProgress' status
    const inProgressSurvey: Partial<TSurvey> = {
      id: "survey-123",
      type: "link", // Current type is 'link'
      name: "Test Survey",
      languages: [
        {
          language: { code: "en" } as unknown as TLanguage,
        } as unknown as TSurveyLanguage,
      ],
      endings: [],
      status: "inProgress", // Survey is already published and in progress
    };

    render(
      <HowToSendCard
        localSurvey={inProgressSurvey as TSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        environment={mockEnvironment as Environment}
      />
    );

    // Open the collapsible to see the content
    const trigger = screen.getByText("common.survey_type");
    await userEvent.click(trigger);

    // Try to change the survey type from 'link' to 'app'
    const appOption = screen.getByRole("radio", {
      name: "common.website_app_survey environments.surveys.edit.app_survey_description",
    });
    await userEvent.click(appOption);

    // Verify that setLocalSurvey was called, indicating the type change was allowed
    // Note: This is the current behavior, but ideally it should be prevented for published surveys
    expect(mockSetLocalSurvey).toHaveBeenCalled();
  });

  test("adds default ending cards for all configured languages when switching to 'link' type in a multilingual survey", async () => {
    // Create a multilingual survey with no endings
    const multilingualSurvey: Partial<TSurvey> = {
      id: "survey-123",
      type: "app", // Starting with app type
      name: "Multilingual Test Survey",
      languages: [
        {
          language: { code: "en" } as unknown as TLanguage,
        } as unknown as TSurveyLanguage,
        {
          language: { code: "fr" } as unknown as TLanguage,
        } as unknown as TSurveyLanguage,
        {
          language: { code: "de" } as unknown as TLanguage,
        } as unknown as TSurveyLanguage,
        {
          language: { code: "es" } as unknown as TLanguage,
        } as unknown as TSurveyLanguage,
      ],
      endings: [], // No endings initially
    };

    render(
      <HowToSendCard
        localSurvey={multilingualSurvey as TSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        environment={mockEnvironment}
      />
    );

    // Open the collapsible to see the content
    const trigger = screen.getByText("common.survey_type");
    await userEvent.click(trigger);

    // Find and click the "link" option to change the survey type
    const linkRadioButton = screen.getByRole("radio", { name: /common.link_survey/ });
    await userEvent.click(linkRadioButton);

    // Verify getDefaultEndingCard was called with the correct languages
    expect(getDefaultEndingCard).toHaveBeenCalledWith(multilingualSurvey.languages, expect.any(Function));

    // Verify setLocalSurvey was called with updated survey containing the new ending
    expect(mockSetLocalSurvey).toHaveBeenCalled();

    // Get the callback function passed to setLocalSurvey
    const setLocalSurveyCallback = mockSetLocalSurvey.mock.calls[0][0];

    // Create a mock previous survey to pass to the callback
    const prevSurvey = { ...multilingualSurvey };

    // Call the callback with the mock previous survey
    const updatedSurvey = setLocalSurveyCallback(prevSurvey as TSurvey);

    // Verify the updated survey has the correct type and endings
    expect(updatedSurvey.type).toBe("link");
    expect(updatedSurvey.endings).toHaveLength(1);
    expect(updatedSurvey.endings[0]).toEqual({
      id: "test-id",
      type: "endScreen",
      headline: "Test Headline",
      subheader: "Test Subheader",
      buttonLabel: "Test Button",
      buttonLink: "https://formbricks.com",
    });

    // Verify that segment is null if it was a temporary segment
    if (prevSurvey.segment?.id === "temp") {
      expect(updatedSurvey.segment).toBeNull();
    }
  });

  test("setSurveyType does not create a temporary segment when environment.id is null", async () => {
    // Create a survey with link type
    const linkSurvey: Partial<TSurvey> = {
      id: "survey-123",
      type: "link",
      name: "Test Survey",
      languages: [
        {
          language: { code: "en" } as unknown as TLanguage,
        } as unknown as TSurveyLanguage,
      ],
      endings: [],
    };

    // Create environment with null id
    const nullIdEnvironment: Partial<Environment> = {
      id: null as unknown as string, // Simulate null environment id
      appSetupCompleted: true,
    };

    // Mock the component with the specific props
    render(
      <HowToSendCard
        localSurvey={linkSurvey as TSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        environment={nullIdEnvironment as Environment}
      />
    );

    // Reset the mock to ensure we only capture calls from this test
    mockSetLocalSurvey.mockClear();

    // Open the collapsible to see the content
    const trigger = screen.getByText("common.survey_type");
    await userEvent.click(trigger);

    // Find and click the app option to change survey type
    const appOption = screen.getByRole("radio", {
      name: "common.website_app_survey environments.surveys.edit.app_survey_description",
    });

    // Click the app option - this should trigger the type change
    await userEvent.click(appOption);

    // Verify setLocalSurvey was called at least once
    expect(mockSetLocalSurvey).toHaveBeenCalled();

    // Get the callback function passed to setLocalSurvey
    const setLocalSurveyCallback = mockSetLocalSurvey.mock.calls[0][0];

    // Create a mock previous survey state
    const prevSurvey = { ...linkSurvey } as TSurvey;

    // Execute the callback to see what it returns
    const result = setLocalSurveyCallback(prevSurvey);

    // Verify the type was updated but no segment was created
    expect(result.type).toBe("app");
    expect(result.segment).toBeUndefined();
  });

  test("setSurveyType does not create a temporary segment when environment.id is undefined", async () => {
    // Create a survey with link type
    const linkSurvey: Partial<TSurvey> = {
      id: "survey-123",
      type: "link",
      name: "Test Survey",
      languages: [
        {
          language: { code: "en" } as unknown as TLanguage,
        } as unknown as TSurveyLanguage,
      ],
      endings: [],
    };

    // Create environment with undefined id
    const undefinedIdEnvironment: Partial<Environment> = {
      id: undefined as unknown as string, // Simulate undefined environment id
      appSetupCompleted: true,
    };

    // Mock the component with the specific props
    render(
      <HowToSendCard
        localSurvey={linkSurvey as TSurvey}
        setLocalSurvey={mockSetLocalSurvey}
        environment={undefinedIdEnvironment as Environment}
      />
    );

    // Reset the mock to ensure we only capture calls from this test
    mockSetLocalSurvey.mockClear();

    // Open the collapsible to see the content
    const trigger = screen.getByText("common.survey_type");
    await userEvent.click(trigger);

    // Find and click the app option to change survey type
    const appOption = screen.getByRole("radio", {
      name: "common.website_app_survey environments.surveys.edit.app_survey_description",
    });

    // Click the app option - this should trigger the type change
    await userEvent.click(appOption);

    // Verify setLocalSurvey was called at least once
    expect(mockSetLocalSurvey).toHaveBeenCalled();

    // Get the callback function passed to setLocalSurvey
    const setLocalSurveyCallback = mockSetLocalSurvey.mock.calls[0][0];

    // Create a mock previous survey state
    const prevSurvey = { ...linkSurvey } as TSurvey;

    // Execute the callback to see what it returns
    const result = setLocalSurveyCallback(prevSurvey);

    // Verify the type was updated but no segment was created
    expect(result.type).toBe("app");
    expect(result.segment).toBeUndefined();
  });
});
