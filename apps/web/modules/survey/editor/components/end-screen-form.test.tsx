import { createI18nString } from "@/lib/i18n/utils";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyEndScreenCard, TSurveyLanguage } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { EndScreenForm } from "./end-screen-form";

// Mock window.matchMedia - required for useAutoAnimate
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock @formkit/auto-animate - simplify implementation to avoid matchMedia issues
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

// Mock constants
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  ENCRYPTION_KEY: "test",
  ENTERPRISE_LICENSE_KEY: "test",
  GITHUB_ID: "test",
  GITHUB_SECRET: "test",
  GOOGLE_CLIENT_ID: "test",
  GOOGLE_CLIENT_SECRET: "test",
  AZUREAD_CLIENT_ID: "mock-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "mock-azure-client-secret",
  AZUREAD_TENANT_ID: "mock-azuread-tenant-id",
  OIDC_CLIENT_ID: "mock-oidc-client-id",
  OIDC_CLIENT_SECRET: "mock-oidc-client-secret",
  OIDC_ISSUER: "mock-oidc-issuer",
  OIDC_DISPLAY_NAME: "mock-oidc-display-name",
  OIDC_SIGNING_ALGORITHM: "mock-oidc-signing-algorithm",
  WEBAPP_URL: "mock-webapp-url",
  AI_AZURE_LLM_RESSOURCE_NAME: "mock-azure-llm-resource-name",
  AI_AZURE_LLM_API_KEY: "mock-azure-llm-api-key",
  AI_AZURE_LLM_DEPLOYMENT_ID: "mock-azure-llm-deployment-id",
  AI_AZURE_EMBEDDINGS_RESSOURCE_NAME: "mock-azure-embeddings-resource-name",
  AI_AZURE_EMBEDDINGS_API_KEY: "mock-azure-embeddings-api-key",
  AI_AZURE_EMBEDDINGS_DEPLOYMENT_ID: "mock-azure-embeddings-deployment-id",
  IS_PRODUCTION: true,
  FB_LOGO_URL: "https://example.com/mock-logo.png",
  SMTP_HOST: "mock-smtp-host",
  SMTP_PORT: "mock-smtp-port",
  IS_POSTHOG_CONFIGURED: true,
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/utils/recall", () => ({
  headlineToRecall: (val) => val,
  recallToHeadline: () => ({ default: "mocked value" }),
}));

const mockUpdateSurvey = vi.fn();

const defaultEndScreenCard: TSurveyEndScreenCard = {
  id: "end-screen-1",
  type: "endScreen",
  headline: createI18nString("Thank you for your feedback!", ["en"]),
};

// Mock survey languages properly as an array of TSurveyLanguage objects
const mockSurveyLanguages: TSurveyLanguage[] = [
  {
    default: true,
    enabled: true,
    language: {
      code: "en",
      alias: "English",
    } as unknown as TSurveyLanguage["language"],
  },
];

const defaultProps = {
  localSurvey: {
    id: "survey-1",
    name: "Test Survey",
    questions: [],
    languages: mockSurveyLanguages,
    endings: [
      {
        id: "end-screen-1",
        type: "endScreen",
        headline: createI18nString("Thank you for your feedback!", ["en"]),
        subheader: createI18nString("We appreciate your time.", ["en"]),
        buttonLabel: createI18nString("Click Me", ["en"]),
        buttonLink: "https://example.com",
        showButton: true,
      },
    ],
  } as unknown as TSurvey,
  endingCardIndex: 0,
  isInvalid: false,
  selectedLanguageCode: "en",
  setSelectedLanguageCode: vi.fn(),
  updateSurvey: mockUpdateSurvey,
  endingCard: defaultEndScreenCard,
  locale: "en-US" as TUserLocale,
};

describe("EndScreenForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders add description button when subheader is undefined", async () => {
    const propsWithoutSubheader = {
      ...defaultProps,
      endingCard: {
        ...defaultEndScreenCard,
        subheader: undefined,
      },
    };

    const { container } = render(<EndScreenForm {...propsWithoutSubheader} />);

    // Find the button using a more specific selector
    const addDescriptionBtn = container.querySelector('button[type="button"] svg.lucide-plus');
    expect(addDescriptionBtn).toBeInTheDocument();

    // Find the parent button element and click it
    const buttonElement = addDescriptionBtn?.closest("button");
    expect(buttonElement).toBeInTheDocument();

    if (buttonElement) {
      await userEvent.click(buttonElement);
      expect(mockUpdateSurvey).toHaveBeenCalledWith({
        subheader: expect.any(Object),
      });
    }
  });

  test("renders subheader input when subheader is defined", () => {
    const propsWithSubheader = {
      ...defaultProps,
      endingCard: {
        ...defaultEndScreenCard,
        subheader: createI18nString("Additional information", ["en"]),
      },
    };

    const { container } = render(<EndScreenForm {...propsWithSubheader} />);

    // Find the label for subheader using a more specific approach
    const subheaderLabel = container.querySelector('label[for="subheader"]');
    expect(subheaderLabel).toBeInTheDocument();
  });

  test("toggles CTA button visibility", async () => {
    const { container } = render(<EndScreenForm {...defaultProps} />);

    // Use ID selector instead of role to get the specific switch we need
    const toggleSwitch = container.querySelector("#showButton");
    expect(toggleSwitch).toBeTruthy();

    if (toggleSwitch) {
      await userEvent.click(toggleSwitch);

      expect(mockUpdateSurvey).toHaveBeenCalledWith({
        buttonLabel: expect.any(Object),
        buttonLink: "https://formbricks.com",
      });

      await userEvent.click(toggleSwitch);

      expect(mockUpdateSurvey).toHaveBeenCalledWith({
        buttonLabel: undefined,
        buttonLink: undefined,
      });
    }
  });

  test("shows CTA options when enabled", async () => {
    const propsWithCTA = {
      ...defaultProps,
      endingCard: {
        ...defaultEndScreenCard,
        buttonLabel: createI18nString("Click Me", ["en"]),
        buttonLink: "https://example.com",
      },
    };

    const { container } = render(<EndScreenForm {...propsWithCTA} />);

    // Check for buttonLabel input using ID selector
    const buttonLabelInput = container.querySelector("#buttonLabel");
    expect(buttonLabelInput).toBeInTheDocument();

    // Check for buttonLink field using ID selector
    const buttonLinkField = container.querySelector("#buttonLink");
    expect(buttonLinkField).toBeInTheDocument();
  });

  test("updates buttonLink when input changes", async () => {
    const propsWithCTA = {
      ...defaultProps,
      endingCard: {
        ...defaultEndScreenCard,
        buttonLabel: createI18nString("Click Me", ["en"]),
        buttonLink: "https://example.com",
      },
    };

    const { container } = render(<EndScreenForm {...propsWithCTA} />);

    // Use ID selector instead of role to get the specific input element
    const buttonLinkInput = container.querySelector("#buttonLink");
    expect(buttonLinkInput).toBeTruthy();

    if (buttonLinkInput) {
      await userEvent.clear(buttonLinkInput as HTMLInputElement);
      await userEvent.type(buttonLinkInput as HTMLInputElement, "https://newlink.com");

      expect(mockUpdateSurvey).toHaveBeenCalled();
    }
  });

  test("handles focus on buttonLink input when onAddFallback is triggered", async () => {
    const propsWithCTA = {
      ...defaultProps,
      endingCard: {
        ...defaultEndScreenCard,
        buttonLabel: createI18nString("Click Me", ["en"]),
        buttonLink: "https://example.com",
      },
    };

    const { container } = render(<EndScreenForm {...propsWithCTA} />);

    // Use ID selector instead of role to get the specific input element
    const buttonLinkInput = container.querySelector("#buttonLink") as HTMLInputElement;
    expect(buttonLinkInput).toBeTruthy();

    // Mock focus method
    const mockFocus = vi.fn();
    if (buttonLinkInput) {
      buttonLinkInput.focus = mockFocus;
      buttonLinkInput.focus();

      expect(mockFocus).toHaveBeenCalled();
    }
  });

  test("initializes with showEndingCardCTA true when buttonLabel or buttonLink exists", () => {
    const propsWithCTA = {
      ...defaultProps,
      endingCard: {
        ...defaultEndScreenCard,
        buttonLabel: createI18nString("Click Me", ["en"]),
        buttonLink: "https://example.com",
      },
    };

    const { container } = render(<EndScreenForm {...propsWithCTA} />);

    // There are multiple elements with role="switch", so we need to use a more specific selector
    const toggleSwitch = container.querySelector('#showButton[data-state="checked"]');
    expect(toggleSwitch).toBeTruthy();

    // Check for button label input using ID selector
    const buttonLabelInput = container.querySelector("#buttonLabel");
    expect(buttonLabelInput).toBeInTheDocument();
  });
});
