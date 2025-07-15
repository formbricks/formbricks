import { ShareViewType } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/types/share";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { ShareSurveyModal } from "./share-survey-modal";

// Mock child components to simplify testing
vi.mock("./shareEmbedModal/share-view", () => ({
  ShareView: ({ tabs, activeId, setActiveId, survey }: any) => (
    <div data-testid="share-view">
      <div data-testid="survey-type">{survey.type}</div>
      <div data-testid="active-tab">{activeId}</div>
      {tabs.map((tab: any) => (
        <button key={tab.id} data-testid={`tab-${tab.id}`} onClick={() => setActiveId(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("./shareEmbedModal/success-view", () => ({
  SuccessView: ({ survey, handleViewChange, handleEmbedViewWithTab }: any) => (
    <div data-testid="success-view">
      <div data-testid="survey-id">{survey.id}</div>
      <button data-testid="change-to-share-view" onClick={() => handleViewChange("share")}>
        Go to Share View
      </button>
      <button data-testid="embed-with-tab" onClick={() => handleEmbedViewWithTab("email")}>
        Embed with Email Tab
      </button>
    </div>
  ),
}));

// Mock tab components
vi.mock("./shareEmbedModal/anonymous-links-tab", () => ({
  AnonymousLinksTab: () => <div data-testid="anonymous-links-tab">Anonymous Links Tab</div>,
}));

vi.mock("./shareEmbedModal/qr-code-tab", () => ({
  QRCodeTab: () => <div data-testid="qr-code-tab">QR Code Tab</div>,
}));

vi.mock("./shareEmbedModal/personal-links-tab", () => ({
  PersonalLinksTab: () => <div data-testid="personal-links-tab">Personal Links Tab</div>,
}));

vi.mock("./shareEmbedModal/email-tab", () => ({
  EmailTab: () => <div data-testid="email-tab">Email Tab</div>,
}));

vi.mock("./shareEmbedModal/website-embed-tab", () => ({
  WebsiteEmbedTab: () => <div data-testid="website-embed-tab">Website Embed Tab</div>,
}));

vi.mock("./shareEmbedModal/social-media-tab", () => ({
  SocialMediaTab: () => <div data-testid="social-media-tab">Social Media Tab</div>,
}));

vi.mock("./shareEmbedModal/dynamic-popup-tab", () => ({
  DynamicPopupTab: () => <div data-testid="dynamic-popup-tab">Dynamic Popup Tab</div>,
}));

vi.mock("./shareEmbedModal/app-tab", () => ({
  AppTab: () => <div data-testid="app-tab">App Tab</div>,
}));

// Mock analysis utils
vi.mock("@/modules/analysis/utils", () => ({
  getSurveyUrl: vi.fn((survey, publicDomain, type) => `${publicDomain}/${survey.id}?type=${type}`),
}));

const mockUser = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
  locale: "en-US",
} as TUser;

const mockSegments: TSegment[] = [
  {
    id: "segment-1",
    title: "Test Segment",
    description: "Test segment description",
    environmentId: "env-123",
    filters: [],
    isPrivate: false,
    surveys: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockLinkSurvey = {
  id: "survey-123",
  name: "Test Link Survey",
  type: "link",
  environmentId: "env-123",
  status: "draft",
} as TSurvey;

const mockAppSurvey = {
  id: "app-survey-123",
  name: "Test App Survey",
  type: "app",
  environmentId: "env-123",
  status: "draft",
} as TSurvey;

describe("ShareSurveyModal", () => {
  const defaultProps = {
    publicDomain: "https://formbricks.com",
    open: true,
    modalView: "start" as const,
    setOpen: vi.fn(),
    user: mockUser,
    segments: mockSegments,
    isContactsEnabled: true,
    isFormbricksCloud: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Modal rendering and basic functionality", () => {
    test("renders modal when open is true", () => {
      render(<ShareSurveyModal {...defaultProps} survey={mockLinkSurvey} />);

      expect(screen.getByTestId("success-view")).toBeInTheDocument();
    });

    test("does not render modal content when open is false", () => {
      render(<ShareSurveyModal {...defaultProps} survey={mockLinkSurvey} open={false} />);

      expect(screen.queryByTestId("success-view")).not.toBeInTheDocument();
      expect(screen.queryByTestId("share-view")).not.toBeInTheDocument();
    });

    test("calls setOpen when modal is closed", async () => {
      const mockSetOpen = vi.fn();
      render(<ShareSurveyModal {...defaultProps} survey={mockLinkSurvey} setOpen={mockSetOpen} />);

      // Simulate modal close by pressing escape
      await userEvent.keyboard("{Escape}");

      await waitFor(() => {
        expect(mockSetOpen).toHaveBeenCalledWith(false);
      });
    });
  });

  describe("View switching functionality", () => {
    test("starts with SuccessView when modalView is 'start'", () => {
      render(<ShareSurveyModal {...defaultProps} survey={mockLinkSurvey} modalView="start" />);

      expect(screen.getByTestId("success-view")).toBeInTheDocument();
      expect(screen.queryByTestId("share-view")).not.toBeInTheDocument();
    });

    test("starts with ShareView when modalView is 'share'", () => {
      render(<ShareSurveyModal {...defaultProps} survey={mockLinkSurvey} modalView="share" />);

      expect(screen.getByTestId("share-view")).toBeInTheDocument();
      expect(screen.queryByTestId("success-view")).not.toBeInTheDocument();
    });

    test("switches from SuccessView to ShareView when button is clicked", async () => {
      render(<ShareSurveyModal {...defaultProps} survey={mockLinkSurvey} modalView="start" />);

      expect(screen.getByTestId("success-view")).toBeInTheDocument();

      const changeViewButton = screen.getByTestId("change-to-share-view");
      await userEvent.click(changeViewButton);

      await waitFor(() => {
        expect(screen.getByTestId("share-view")).toBeInTheDocument();
        expect(screen.queryByTestId("success-view")).not.toBeInTheDocument();
      });
    });

    test("switches to ShareView with specific tab when handleEmbedViewWithTab is called", async () => {
      render(<ShareSurveyModal {...defaultProps} survey={mockLinkSurvey} modalView="start" />);

      const embedButton = screen.getByTestId("embed-with-tab");
      await userEvent.click(embedButton);

      await waitFor(() => {
        expect(screen.getByTestId("share-view")).toBeInTheDocument();
        expect(screen.getByTestId("active-tab")).toHaveTextContent("email");
      });
    });
  });

  describe("Survey type specific behavior", () => {
    test("displays link survey tabs for link type survey", () => {
      render(<ShareSurveyModal {...defaultProps} survey={mockLinkSurvey} modalView="share" />);

      expect(screen.getByTestId("survey-type")).toHaveTextContent("link");
      expect(screen.getByTestId("tab-anon-links")).toBeInTheDocument();
      expect(screen.getByTestId("tab-personal-links")).toBeInTheDocument();
      expect(screen.getByTestId("tab-website-embed")).toBeInTheDocument();
      expect(screen.getByTestId("tab-email")).toBeInTheDocument();
      expect(screen.getByTestId("tab-social-media")).toBeInTheDocument();
      expect(screen.getByTestId("tab-qr-code")).toBeInTheDocument();
      expect(screen.getByTestId("tab-dynamic-popup")).toBeInTheDocument();
    });

    test("displays app survey tabs for app type survey", () => {
      render(<ShareSurveyModal {...defaultProps} survey={mockAppSurvey} modalView="share" />);

      expect(screen.getByTestId("survey-type")).toHaveTextContent("app");
      expect(screen.getByTestId("tab-app")).toBeInTheDocument();

      // Link-specific tabs should not be present for app surveys
      expect(screen.queryByTestId("tab-anonymous_links")).not.toBeInTheDocument();
      expect(screen.queryByTestId("tab-personal_links")).not.toBeInTheDocument();
    });

    test("sets correct default active tab based on survey type", () => {
      const linkSurveyRender = render(
        <ShareSurveyModal {...defaultProps} survey={mockLinkSurvey} modalView="share" />
      );

      expect(screen.getByTestId("active-tab")).toHaveTextContent(ShareViewType.ANON_LINKS);

      linkSurveyRender.unmount();

      render(<ShareSurveyModal {...defaultProps} survey={mockAppSurvey} modalView="share" />);

      expect(screen.getByTestId("active-tab")).toHaveTextContent(ShareViewType.APP);
    });
  });

  describe("Tab switching functionality", () => {
    test("switches active tab when tab button is clicked", async () => {
      render(<ShareSurveyModal {...defaultProps} survey={mockLinkSurvey} modalView="share" />);

      expect(screen.getByTestId("active-tab")).toHaveTextContent(ShareViewType.ANON_LINKS);

      const emailTab = screen.getByTestId("tab-email");
      await userEvent.click(emailTab);

      await waitFor(() => {
        expect(screen.getByTestId("active-tab")).toHaveTextContent(ShareViewType.EMAIL);
      });
    });
  });

  describe("Props passing", () => {
    test("passes correct props to SuccessView", () => {
      render(<ShareSurveyModal {...defaultProps} survey={mockLinkSurvey} modalView="start" />);

      expect(screen.getByTestId("survey-id")).toHaveTextContent(mockLinkSurvey.id);
    });

    test("passes correct props to ShareView", () => {
      render(<ShareSurveyModal {...defaultProps} survey={mockLinkSurvey} modalView="share" />);

      expect(screen.getByTestId("survey-type")).toHaveTextContent(mockLinkSurvey.type);
      expect(screen.getByTestId("active-tab")).toHaveTextContent(ShareViewType.ANON_LINKS);
    });
  });

  describe("URL handling", () => {
    test("initializes survey URL correctly", async () => {
      const { getSurveyUrl } = await import("@/modules/analysis/utils");
      const getSurveyUrlMock = vi.mocked(getSurveyUrl);

      render(<ShareSurveyModal {...defaultProps} survey={mockLinkSurvey} />);

      expect(getSurveyUrlMock).toHaveBeenCalledWith(mockLinkSurvey, defaultProps.publicDomain, "default");
    });
  });

  describe("Effect handling", () => {
    test("updates showView when modalView prop changes", async () => {
      const { rerender } = render(
        <ShareSurveyModal {...defaultProps} survey={mockLinkSurvey} modalView="start" />
      );

      expect(screen.getByTestId("success-view")).toBeInTheDocument();

      rerender(<ShareSurveyModal {...defaultProps} survey={mockLinkSurvey} modalView="share" />);

      await waitFor(() => {
        expect(screen.getByTestId("share-view")).toBeInTheDocument();
      });
    });

    test("updates showView when open prop changes", async () => {
      const { rerender } = render(
        <ShareSurveyModal {...defaultProps} survey={mockLinkSurvey} modalView="start" open={false} />
      );

      expect(screen.queryByTestId("success-view")).not.toBeInTheDocument();

      rerender(<ShareSurveyModal {...defaultProps} survey={mockLinkSurvey} modalView="start" open={true} />);

      await waitFor(() => {
        expect(screen.getByTestId("success-view")).toBeInTheDocument();
      });
    });
  });
});
