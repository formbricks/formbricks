// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { Survey } from "./survey";

const apiClientMocks = vi.hoisted(() => ({
  createDisplay: vi.fn(),
  createResponse: vi.fn(),
  updateResponse: vi.fn(),
  getResponseIdByDisplayId: vi.fn(),
}));

const offlineStorageMocks = vi.hoisted(() => ({
  addPendingResponse: vi.fn(),
  countPendingResponses: vi.fn(),
  getPendingResponses: vi.fn(),
  removePendingResponse: vi.fn(),
  clearSurveyProgress: vi.fn(),
  getSurveyProgress: vi.fn(),
  patchSurveyProgressSnapshot: vi.fn(),
  saveSurveyProgress: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  ApiClient: vi.fn(function ApiClient() {
    return apiClientMocks;
  }),
}));

vi.mock("@/lib/offline-storage", () => ({
  addPendingResponse: offlineStorageMocks.addPendingResponse,
  countPendingResponses: offlineStorageMocks.countPendingResponses,
  getPendingResponses: offlineStorageMocks.getPendingResponses,
  removePendingResponse: offlineStorageMocks.removePendingResponse,
  clearSurveyProgress: offlineStorageMocks.clearSurveyProgress,
  getSurveyProgress: offlineStorageMocks.getSurveyProgress,
  patchSurveyProgressSnapshot: offlineStorageMocks.patchSurveyProgressSnapshot,
  saveSurveyProgress: offlineStorageMocks.saveSurveyProgress,
}));

vi.mock("@/lib/use-online-status", () => ({
  useOnlineStatus: () => true,
}));

vi.mock("@/lib/recall", () => ({
  parseRecallInformation: (element: unknown) => element,
}));

vi.mock("@/components/general/block-conditional", () => ({
  BlockConditional: ({ block, onSubmit }: any) => (
    <button
      data-testid={`submit-${block.id}`}
      onClick={() =>
        onSubmit(
          { [block.elements[0].id]: `${block.id}-answer` },
          {
            [block.elements[0].id]: 123,
          }
        )
      }>
      Submit {block.id}
    </button>
  ),
}));

vi.mock("@/components/wrappers/stacked-cards-container", () => ({
  StackedCardsContainer: ({ currentBlockId, getCardContent, survey }: any) => {
    const blockIndex =
      currentBlockId === "start" ? -1 : survey.blocks.findIndex((block: any) => block.id === currentBlockId);
    return <div data-testid="survey-root">{getCardContent(blockIndex, 0)}</div>;
  },
}));

vi.mock("@/components/wrappers/auto-close-wrapper", () => ({
  AutoCloseWrapper: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/general/ending-card", () => ({
  EndingCard: () => <div data-testid="ending-card">Ending</div>,
}));

vi.mock("@/components/general/welcome-card", () => ({
  WelcomeCard: () => <div data-testid="welcome-card">Welcome</div>,
}));

vi.mock("@/components/general/error-component", () => ({
  ErrorComponent: () => <div>Error</div>,
}));

vi.mock("@/components/general/response-error-component", () => ({
  ResponseErrorComponent: () => <div>Response Error</div>,
}));

vi.mock("@/components/general/formbricks-branding", () => ({
  FormbricksBranding: () => null,
}));

vi.mock("@/components/general/language-switch", () => ({
  LanguageSwitch: () => null,
}));

vi.mock("@/components/general/progress-bar", () => ({
  ProgressBar: () => null,
}));

vi.mock("@/components/general/recaptcha-branding", () => ({
  RecaptchaBranding: () => null,
}));

vi.mock("@/components/general/survey-close-button", () => ({
  SurveyCloseButton: () => null,
}));

const defaultLanguage = {
  default: true,
  enabled: true,
  language: {
    id: "lang123456789012345678901",
    code: "en",
    alias: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    projectId: "project12345678901234567",
  },
};

const baseSurvey: TJsEnvironmentStateSurvey = {
  id: "survey12345678901234567890",
  name: "Offline Resume Survey",
  type: "link",
  status: "inProgress",
  questions: [],
  blocks: [
    {
      id: "block-1",
      elements: [
        {
          id: "q1",
          type: TSurveyElementTypeEnum.OpenText,
          required: false,
        },
      ],
      logic: [],
    },
    {
      id: "block-2",
      elements: [
        {
          id: "q2",
          type: TSurveyElementTypeEnum.OpenText,
          required: false,
        },
      ],
      logic: [],
    },
  ],
  endings: [{ id: "ending-1" }],
  welcomeCard: { enabled: false, timeToFinish: false, showResponseCount: false },
  variables: [],
  styling: { overwriteThemeStyling: false },
  recontactDays: null,
  displayLimit: null,
  displayPercentage: null,
  languages: [defaultLanguage],
  segment: null,
  hiddenFields: { enabled: false, fieldIds: [] },
  projectOverwrites: null,
  triggers: [],
  displayOption: "displayOnce",
  showLanguageSwitch: false,
  isBackButtonHidden: false,
  isAutoProgressingEnabled: false,
  recaptcha: {
    enabled: false,
  },
} as unknown as TJsEnvironmentStateSurvey;

const makeProgress = (overrides: Record<string, unknown> = {}) => ({
  surveyId: baseSurvey.id,
  blockId: "block-2",
  responseData: { q1: "saved-answer" },
  ttc: { q1: 111 },
  currentVariables: { savedVar: "saved" },
  history: ["block-1"],
  selectedLanguage: "en",
  surveyStateSnapshot: {
    responseId: null,
    displayId: "display1234567890123456789",
    surveyId: baseSurvey.id,
    singleUseId: null,
    userId: null,
    contactId: null,
    responseAcc: {
      finished: false,
      data: { q1: "saved-answer" },
      ttc: { q1: 111 },
      variables: { savedVar: "saved" },
    },
  },
  updatedAt: Date.now(),
  ...overrides,
});

const renderSurvey = () =>
  render(
    <Survey
      appUrl="http://localhost:3000"
      environmentId="env1234567890123456789012"
      survey={baseSurvey}
      styling={{} as any}
      isBrandingEnabled={false}
      languageCode="en"
      offlineSupport
      isSpamProtectionEnabled={false}
    />
  );

describe("Survey offline restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    offlineStorageMocks.addPendingResponse.mockResolvedValue(1);
    offlineStorageMocks.countPendingResponses.mockResolvedValue(0);
    offlineStorageMocks.getPendingResponses.mockResolvedValue([]);
    offlineStorageMocks.removePendingResponse.mockResolvedValue(undefined);
    offlineStorageMocks.clearSurveyProgress.mockResolvedValue(undefined);
    offlineStorageMocks.patchSurveyProgressSnapshot.mockResolvedValue(undefined);
    offlineStorageMocks.saveSurveyProgress.mockResolvedValue(undefined);
    apiClientMocks.createDisplay.mockResolvedValue({ ok: true, data: { id: "display-created" } });
    apiClientMocks.createResponse.mockResolvedValue({ ok: true, data: { id: "response-created" } });
    apiClientMocks.updateResponse.mockResolvedValue({ ok: true, data: { quotaFull: false } });
    apiClientMocks.getResponseIdByDisplayId.mockResolvedValue({ ok: true, data: { responseId: null } });
    window.parent.postMessage = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  test("recovers responseId from displayId and continues on the update path", async () => {
    offlineStorageMocks.getSurveyProgress.mockResolvedValue(makeProgress());
    apiClientMocks.getResponseIdByDisplayId.mockResolvedValue({
      ok: true,
      data: { responseId: "response-recovered" },
    });

    renderSurvey();

    await waitFor(() => {
      expect(apiClientMocks.getResponseIdByDisplayId).toHaveBeenCalledWith("display1234567890123456789");
    });

    fireEvent.click(await screen.findByTestId("submit-block-2"));

    await waitFor(() => {
      expect(apiClientMocks.updateResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          responseId: "response-recovered",
          data: { q2: "block-2-answer" },
        })
      );
    });

    expect(apiClientMocks.createResponse).not.toHaveBeenCalled();
    expect(apiClientMocks.createDisplay).not.toHaveBeenCalled();
    expect(offlineStorageMocks.patchSurveyProgressSnapshot).toHaveBeenCalledWith(baseSurvey.id, {
      responseId: "response-recovered",
    });
  });

  test("bootstraps create from restored progress when display lookup returns no response", async () => {
    offlineStorageMocks.getSurveyProgress.mockResolvedValue(makeProgress());

    renderSurvey();

    fireEvent.click(await screen.findByTestId("submit-block-2"));

    await waitFor(() => {
      expect(apiClientMocks.createResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          displayId: "display1234567890123456789",
          finished: true,
          data: { q1: "saved-answer", q2: "block-2-answer" },
          ttc: { q1: 111, q2: 123 },
          variables: { savedVar: "saved" },
        })
      );
    });

    expect(apiClientMocks.updateResponse).not.toHaveBeenCalled();
    expect(apiClientMocks.createDisplay).not.toHaveBeenCalled();
    expect(offlineStorageMocks.patchSurveyProgressSnapshot).toHaveBeenCalledWith(baseSurvey.id, {
      responseId: "response-created",
    });
  });

  test("creates a new display and bootstraps from restored progress when no ids are saved", async () => {
    offlineStorageMocks.getSurveyProgress.mockResolvedValue(
      makeProgress({
        surveyStateSnapshot: {
          responseId: null,
          displayId: null,
          surveyId: baseSurvey.id,
          singleUseId: null,
          userId: null,
          contactId: null,
          responseAcc: {
            finished: false,
            data: { q1: "saved-answer" },
            ttc: { q1: 111 },
            variables: { savedVar: "saved" },
          },
        },
      })
    );

    renderSurvey();

    await waitFor(() => {
      expect(apiClientMocks.createDisplay).toHaveBeenCalled();
    });

    fireEvent.click(await screen.findByTestId("submit-block-2"));

    await waitFor(() => {
      expect(apiClientMocks.createResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          displayId: "display-created",
          data: { q1: "saved-answer", q2: "block-2-answer" },
        })
      );
    });

    expect(offlineStorageMocks.patchSurveyProgressSnapshot).toHaveBeenCalledWith(baseSurvey.id, {
      displayId: "display-created",
    });
  });

  test("skips responseId recovery while pending offline entries exist", async () => {
    offlineStorageMocks.getSurveyProgress.mockResolvedValue(makeProgress());
    offlineStorageMocks.countPendingResponses.mockResolvedValue(2);

    renderSurvey();

    await waitFor(() => {
      expect(offlineStorageMocks.countPendingResponses).toHaveBeenCalled();
    });

    expect(apiClientMocks.getResponseIdByDisplayId).not.toHaveBeenCalled();
  });

  test("clears stale finished progress instead of restoring the ending card", async () => {
    offlineStorageMocks.getSurveyProgress.mockResolvedValue(
      makeProgress({
        blockId: "ending-1",
        surveyStateSnapshot: {
          responseId: "response-finished",
          displayId: "display1234567890123456789",
          surveyId: baseSurvey.id,
          singleUseId: null,
          userId: null,
          contactId: null,
          responseAcc: {
            finished: true,
            data: { q1: "saved-answer", q2: "done" },
            ttc: { q1: 111, q2: 123 },
            variables: { savedVar: "saved" },
          },
        },
      })
    );

    renderSurvey();

    await waitFor(() => {
      expect(offlineStorageMocks.clearSurveyProgress).toHaveBeenCalledWith(baseSurvey.id);
    });

    expect(apiClientMocks.getResponseIdByDisplayId).not.toHaveBeenCalled();
  });
});
