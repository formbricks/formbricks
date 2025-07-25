import { AddActionModal } from "@/modules/survey/editor/components/add-action-modal";
import { ActionClass, OrganizationRole } from "@prisma/client";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
// Adjust path as necessary
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { WhenToSendCard } from "./when-to-send-card";

// Mock environment-dependent modules
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  FORMBRICKS_API_HOST: "http://localhost:3000",
  FORMBRICKS_ENVIRONMENT_ID: "test-env-id",
}));

vi.mock("@/modules/survey/editor/actions", () => ({}));

// Mock @tolgee/react
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string, params?: any) => {
      if (key === "environments.surveys.edit.show_to_x_percentage_of_targeted_users") {
        return `Show to ${params.percentage}% of targeted users`;
      }
      return key;
    },
  }),
}));

// Mock @formkit/auto-animate/react
const { mockAutoAnimate } = vi.hoisted(() => {
  return { mockAutoAnimate: vi.fn(() => [vi.fn()]) };
});
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: mockAutoAnimate,
}));

// Mock AddActionModal
vi.mock("@/modules/survey/editor/components/add-action-modal", () => ({
  AddActionModal: vi.fn(({ open, isReadOnly }) =>
    open ? (
      <div data-testid="add-action-modal" data-readonly={isReadOnly}>
        AddActionModal
      </div>
    ) : null
  ),
}));

// Mock AdvancedOptionToggle
vi.mock("@/modules/ui/components/advanced-option-toggle", () => ({
  AdvancedOptionToggle: vi.fn(({ children, isChecked, onToggle, title, htmlId, childBorder }) => (
    <div data-testid={`advanced-toggle-${htmlId}`} data-child-border={childBorder}>
      <label htmlFor={`toggle-input-${htmlId}`}>{title}</label>
      <input
        type="checkbox"
        id={`toggle-input-${htmlId}`}
        data-testid={`toggle-checkbox-${htmlId}`}
        checked={isChecked}
        onChange={onToggle}
      />
      {isChecked && children}
    </div>
  )),
}));

// Mock membership utils
const mockGetAccessFlags = vi.fn();
vi.mock("@/lib/membership/utils", () => ({
  getAccessFlags: (...args: any[]) => mockGetAccessFlags(...args),
}));

const mockGetTeamPermissionFlags = vi.fn();
vi.mock("@/modules/ee/teams/utils/teams", () => ({
  getTeamPermissionFlags: (...args: any[]) => mockGetTeamPermissionFlags(...args),
}));

const mockSurveyAppBase = {
  id: "survey1",
  name: "App Survey",
  type: "app",
  environmentId: "env1",
  status: "draft",
  questions: [
    {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question 1" },
      required: true,
    } as unknown as TSurveyQuestion,
  ],
  triggers: [],
  recontactDays: null,
  displayPercentage: null,
  autoClose: null,
  delay: 0,
  welcomeCard: { enabled: false } as TSurvey["welcomeCard"],
  hiddenFields: { enabled: false, fieldIds: [] },
  languages: [],
  styling: null,
  variables: [],
  displayLimit: null,
  singleUse: null,
  surveyClosedMessage: null,
  segment: null,
  closeOnDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  autoComplete: null,
} as unknown as TSurvey;

const mockActionClasses: ActionClass[] = [
  {
    id: "action1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Action 1",
    description: "Description 1",
    type: "code",
    environmentId: "env1",
    key: "codeActionKey",
    noCodeConfig: null,
  },
  {
    id: "action2",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "No Code Action",
    description: "A no-code action",
    type: "noCode",
    environmentId: "env1",
    key: null,
    noCodeConfig: {
      type: "click",
      elementSelector: { cssSelector: ".button" },
      urlFilters: [{ rule: "exactMatch", value: "http://example.com" }],
    },
  },
];

describe("WhenToSendCard Component Tests", () => {
  let localSurvey: TSurvey;
  let setLocalSurvey: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localSurvey = JSON.parse(JSON.stringify(mockSurveyAppBase)); // Deep copy
    setLocalSurvey = vi.fn();
    mockGetAccessFlags.mockReturnValue({
      isViewer: false,
      isMember: false,
      isAdmin: true,
      isOwner: false,
    }); // Default to admin
    mockGetTeamPermissionFlags.mockReturnValue({
      hasReadAccess: false,
      hasWriteAccess: true,
      isMaintainer: true,
      isOwner: false,
    }); // Default to full project access
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("does not render for link surveys", () => {
    localSurvey.type = "link";
    const { container } = render(
      <WhenToSendCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        environmentId="env1"
        propActionClasses={mockActionClasses}
        membershipRole={OrganizationRole.owner}
        projectPermission={null}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  test("renders correctly for app surveys and opens by default", () => {
    render(
      <WhenToSendCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        environmentId="env1"
        propActionClasses={mockActionClasses}
        membershipRole={OrganizationRole.owner}
        projectPermission={null}
      />
    );
    expect(screen.getByText("environments.surveys.edit.survey_trigger")).toBeInTheDocument();
    // Check if content is visible (e.g., "Add Action" button)
    expect(screen.getByText("common.add_action")).toBeInTheDocument();
  });

  test("collapses and expands content", async () => {
    render(
      <WhenToSendCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        environmentId="env1"
        propActionClasses={mockActionClasses}
        membershipRole={OrganizationRole.owner}
        projectPermission={null}
      />
    );
    // The clickable element is a div with id="whenToSendCardTrigger"
    // We find it by locating its primary text content first, then its specific parent
    const titleElement = screen.getByText("environments.surveys.edit.survey_trigger");
    const triggerButton = titleElement.closest('div[id="whenToSendCardTrigger"]');

    if (!triggerButton) {
      throw new Error(
        "Trigger button with id 'whenToSendCardTrigger' not found. The test selector might need an update if the component structure changed."
      );
    }

    // Content is initially open
    expect(screen.getByText("common.add_action")).toBeVisible();

    await userEvent.click(triggerButton);
    // Use waitFor as Radix Collapsible might have animations or async updates
    await waitFor(() => {
      expect(screen.queryByText("common.add_action")).not.toBeInTheDocument();
    });

    await userEvent.click(triggerButton);
    await waitFor(() => {
      expect(screen.getByText("common.add_action")).toBeVisible();
    });
  });

  test("opens AddActionModal when 'Add Action' button is clicked", async () => {
    render(
      <WhenToSendCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        environmentId="env1"
        propActionClasses={mockActionClasses}
        membershipRole={OrganizationRole.owner}
        projectPermission={null}
      />
    );
    const addButton = screen.getByText("common.add_action");
    await userEvent.click(addButton);
    expect(screen.getByTestId("add-action-modal")).toBeInTheDocument();
    // Check the props of the last call to AddActionModal
    const lastCallArgs = vi.mocked(AddActionModal).mock.lastCall;
    expect(lastCallArgs).not.toBeUndefined(); // Ensure it was called
    if (lastCallArgs) {
      expect(lastCallArgs[0].open).toBe(true);
    }
  });

  test("removes a trigger", async () => {
    localSurvey.triggers = [{ actionClass: mockActionClasses[0] }];
    const { container } = render(
      <WhenToSendCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        environmentId="env1"
        propActionClasses={mockActionClasses}
        membershipRole={OrganizationRole.owner}
        projectPermission={null}
      />
    );
    expect(screen.getByText(mockActionClasses[0].name)).toBeInTheDocument();
    const trashIcon = container.querySelector("svg.lucide-trash2");
    if (!trashIcon)
      throw new Error(
        "Trash icon not found using selector 'svg.lucide-trash2'. Check component's class names."
      );
    await userEvent.click(trashIcon);
    expect(setLocalSurvey).toHaveBeenCalledWith(expect.objectContaining({ triggers: [] }));
  });

  describe("Delay functionality", () => {
    test("toggles delay and updates survey", async () => {
      const surveyStep0 = { ...localSurvey, delay: 0 }; // Start with delay 0

      const { rerender } = render(
        <WhenToSendCard
          localSurvey={surveyStep0}
          setLocalSurvey={setLocalSurvey}
          environmentId="env1"
          propActionClasses={mockActionClasses}
          membershipRole={OrganizationRole.owner}
          projectPermission={null}
        />
      );
      const delayToggleCheckbox = screen.getByTestId("toggle-checkbox-delay");

      // Enable delay
      await userEvent.click(delayToggleCheckbox);
      // Component, seeing delay as 0, calls setLocalSurvey with delay: 5
      expect(setLocalSurvey).toHaveBeenNthCalledWith(1, expect.objectContaining({ delay: 5 }));

      // Simulate the parent component re-rendering with the updated survey state
      const surveyStep1 = { ...surveyStep0, delay: 5 };
      rerender(
        <WhenToSendCard
          localSurvey={surveyStep1} // Now pass the survey with delay: 5
          setLocalSurvey={setLocalSurvey}
          environmentId="env1"
          propActionClasses={mockActionClasses}
          membershipRole={OrganizationRole.owner}
          projectPermission={null}
        />
      );

      // Disable delay
      await userEvent.click(delayToggleCheckbox);
      // Component, seeing delay as 5, calls setLocalSurvey with delay: 0
      expect(setLocalSurvey).toHaveBeenNthCalledWith(2, expect.objectContaining({ delay: 0 }));
    });

    test("updates delay input", async () => {
      localSurvey.delay = 5; // Start with delay enabled
      render(
        <WhenToSendCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          environmentId="env1"
          propActionClasses={mockActionClasses}
          membershipRole={OrganizationRole.owner}
          projectPermission={null}
        />
      );
      const delayInput = screen.getByLabelText(
        /environments\.surveys\.edit\.wait.*environments\.surveys\.edit\.seconds_before_showing_the_survey/i
      );
      await userEvent.clear(delayInput);
      await userEvent.type(delayInput, "15");
      fireEvent.change(delayInput, { target: { value: "15" } }); // Ensure change event fires
      expect(setLocalSurvey).toHaveBeenCalledWith(expect.objectContaining({ delay: 15 }));

      // Test invalid input
      await userEvent.clear(delayInput);
      await userEvent.type(delayInput, "abc");
      fireEvent.change(delayInput, { target: { value: "abc" } });
      expect(setLocalSurvey).toHaveBeenCalledWith(expect.objectContaining({ delay: 0 }));

      await userEvent.clear(delayInput);
      await userEvent.type(delayInput, "0");
      fireEvent.change(delayInput, { target: { value: "0" } });
      expect(setLocalSurvey).toHaveBeenCalledWith(expect.objectContaining({ delay: 0 }));
    });
  });

  describe("Auto-close functionality", () => {
    test("updates auto-close input", async () => {
      localSurvey.autoClose = 10; // Start with auto-close enabled
      render(
        <WhenToSendCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          environmentId="env1"
          propActionClasses={mockActionClasses}
          membershipRole={OrganizationRole.owner}
          projectPermission={null}
        />
      );
      const autoCloseInput = screen.getByLabelText(
        /environments\.surveys\.edit\.automatically_close_survey_after.*environments\.surveys\.edit\.seconds_after_trigger_the_survey_will_be_closed_if_no_response/i
      );
      await userEvent.clear(autoCloseInput);
      await userEvent.type(autoCloseInput, "20");
      fireEvent.change(autoCloseInput, { target: { value: "20" } });
      expect(setLocalSurvey).toHaveBeenCalledWith(expect.objectContaining({ autoClose: 20 }));

      // Test invalid input
      await userEvent.clear(autoCloseInput);
      await userEvent.type(autoCloseInput, "abc");
      fireEvent.change(autoCloseInput, { target: { value: "abc" } });
      expect(setLocalSurvey).toHaveBeenCalledWith(expect.objectContaining({ autoClose: 0 }));

      await userEvent.clear(autoCloseInput);
      await userEvent.type(autoCloseInput, "0");
      fireEvent.change(autoCloseInput, { target: { value: "0" } });
      expect(setLocalSurvey).toHaveBeenCalledWith(expect.objectContaining({ autoClose: 0 }));
    });
  });

  describe("Display Percentage (Randomizer) functionality", () => {
    test("toggles display percentage and updates survey", async () => {
      render(
        <WhenToSendCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          environmentId="env1"
          propActionClasses={mockActionClasses}
          membershipRole={OrganizationRole.owner}
          projectPermission={null}
        />
      );
      const randomizerToggleCheckbox = screen.getByTestId("toggle-checkbox-randomizer");

      // Enable randomizer
      await userEvent.click(randomizerToggleCheckbox);
      expect(setLocalSurvey).toHaveBeenCalledWith(expect.objectContaining({ displayPercentage: 50 }));
      localSurvey.displayPercentage = 50; // Simulate state update

      // Disable randomizer
      await userEvent.click(randomizerToggleCheckbox);
      expect(setLocalSurvey).toHaveBeenCalledWith(expect.objectContaining({ displayPercentage: null }));
    });

    test("updates display percentage input", async () => {
      localSurvey.displayPercentage = 50; // Start with randomizer enabled
      render(
        <WhenToSendCard
          localSurvey={localSurvey}
          setLocalSurvey={setLocalSurvey}
          environmentId="env1"
          propActionClasses={mockActionClasses}
          membershipRole={OrganizationRole.owner}
          projectPermission={null}
        />
      );
      // The mock for t('environments.surveys.edit.show_to_x_percentage_of_targeted_users')
      // returns "Show to {percentage}% of targeted users"
      const randomizerInput = screen.getByLabelText(
        `Show to ${localSurvey.displayPercentage}% of targeted users`
      );

      await userEvent.clear(randomizerInput);
      await userEvent.type(randomizerInput, "75.55");
      fireEvent.change(randomizerInput, { target: { value: "75.55" } });
      expect(setLocalSurvey).toHaveBeenCalledWith(expect.objectContaining({ displayPercentage: 75.55 }));

      // Test NaN input
      await userEvent.clear(randomizerInput);
      await userEvent.type(randomizerInput, "abc");
      fireEvent.change(randomizerInput, { target: { value: "abc" } });
      expect(setLocalSurvey).toHaveBeenCalledWith(expect.objectContaining({ displayPercentage: 0.01 }));

      // Test value < 0.01
      await userEvent.clear(randomizerInput);
      await userEvent.type(randomizerInput, "0.001");
      fireEvent.change(randomizerInput, { target: { value: "0.001" } });
      expect(setLocalSurvey).toHaveBeenCalledWith(expect.objectContaining({ displayPercentage: 0.01 }));

      // Test value > 100
      await userEvent.clear(randomizerInput);
      await userEvent.type(randomizerInput, "150");
      fireEvent.change(randomizerInput, { target: { value: "150" } });
      expect(setLocalSurvey).toHaveBeenCalledWith(expect.objectContaining({ displayPercentage: 100 }));

      // Test rounding
      await userEvent.clear(randomizerInput);
      await userEvent.type(randomizerInput, "33.336");
      fireEvent.change(randomizerInput, { target: { value: "33.336" } });
      expect(setLocalSurvey).toHaveBeenCalledWith(expect.objectContaining({ displayPercentage: 33.34 }));

      await userEvent.clear(randomizerInput);
      await userEvent.type(randomizerInput, "33.334");
      fireEvent.change(randomizerInput, { target: { value: "33.334" } });
      expect(setLocalSurvey).toHaveBeenCalledWith(expect.objectContaining({ displayPercentage: 33.33 }));
    });
  });
});

// Example of keeping one of the original tests if it's still relevant as a utility test:
describe("WhenToSendCard internal logic (original tests)", () => {
  afterEach(() => {
    cleanup();
  });

  test("handleTriggerDelay correctly handles invalid inputs (isolated test)", () => {
    const localSurvey = {
      id: "3",
      name: "Test Survey",
      type: "app",
      createdAt: new Date("2024-02-13T11:00:00.000Z"),
      updatedAt: new Date("2024-02-13T11:00:00.000Z"),
      questions: [],
      triggers: [],
      delay: 5,
    } as unknown as TSurvey;

    const setLocalSurvey = vi.fn();

    // Recreate the handleTriggerDelay function here to isolate its logic
    // This is a simplified version of what's in the component
    const testHandleTriggerDelay = (e: any, currentSurvey: TSurvey, setSurveyFn: any) => {
      let value = parseInt(e.target.value);
      if (value < 1 || Number.isNaN(value)) {
        value = 0;
      }
      const updatedSurvey = { ...currentSurvey, delay: value };
      setSurveyFn(updatedSurvey);
    };

    testHandleTriggerDelay({ target: { value: "abc" } }, localSurvey, setLocalSurvey);
    expect(setLocalSurvey).toHaveBeenCalledWith(expect.objectContaining({ delay: 0 }));

    setLocalSurvey.mockClear();
    testHandleTriggerDelay({ target: { value: "0" } }, localSurvey, setLocalSurvey);
    expect(setLocalSurvey).toHaveBeenCalledWith(expect.objectContaining({ delay: 0 }));
  });
});
