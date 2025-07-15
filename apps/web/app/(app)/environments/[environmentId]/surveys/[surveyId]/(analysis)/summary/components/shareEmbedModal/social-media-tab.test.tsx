import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SocialMediaTab } from "./social-media-tab";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock window.open
Object.defineProperty(window, "open", {
  writable: true,
  value: vi.fn(),
});

const mockSurveyUrl = "https://app.formbricks.com/s/survey1";
const mockSurveyTitle = "Test Survey";

const expectedPlatforms = [
  { name: "LinkedIn", description: "Share on LinkedIn" },
  { name: "Threads", description: "Share on Threads" },
  { name: "Facebook", description: "Share on Facebook" },
  { name: "Reddit", description: "Share on Reddit" },
  { name: "X", description: "Share on X (formerly Twitter)" },
];

describe("SocialMediaTab", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders all social media platforms with correct names", () => {
    render(<SocialMediaTab surveyUrl={mockSurveyUrl} surveyTitle={mockSurveyTitle} />);

    expectedPlatforms.forEach((platform) => {
      expect(screen.getByText(platform.name)).toBeInTheDocument();
    });
  });

  test("renders source tracking alert with correct content", () => {
    render(<SocialMediaTab surveyUrl={mockSurveyUrl} surveyTitle={mockSurveyTitle} />);

    expect(
      screen.getByText("environments.surveys.share.social_media.source_tracking_enabled")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.share.social_media.source_tracking_enabled_alert_description")
    ).toBeInTheDocument();
    expect(screen.getByText("common.learn_more")).toBeInTheDocument();

    const learnMoreButton = screen.getByRole("button", { name: "common.learn_more" });
    expect(learnMoreButton).toBeInTheDocument();
  });

  test("renders platform buttons for all platforms", () => {
    render(<SocialMediaTab surveyUrl={mockSurveyUrl} surveyTitle={mockSurveyTitle} />);

    const platformButtons = expectedPlatforms.map((platform) =>
      screen.getByRole("button", { name: new RegExp(platform.name, "i") })
    );
    expect(platformButtons).toHaveLength(expectedPlatforms.length);
  });

  test("opens sharing window when LinkedIn button is clicked", async () => {
    const mockWindowOpen = vi.spyOn(window, "open");
    render(<SocialMediaTab surveyUrl={mockSurveyUrl} surveyTitle={mockSurveyTitle} />);

    const linkedInButton = screen.getByRole("button", { name: /linkedin/i });
    await userEvent.click(linkedInButton);

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining("linkedin.com/shareArticle"),
      "share-dialog",
      "width=1024,height=768,location=no,toolbar=no,status=no,menubar=no,scrollbars=yes,resizable=yes,noopener=yes,noreferrer=yes"
    );
  });

  test("includes source tracking in shared URLs", async () => {
    const mockWindowOpen = vi.spyOn(window, "open");
    render(<SocialMediaTab surveyUrl={mockSurveyUrl} surveyTitle={mockSurveyTitle} />);

    const linkedInButton = screen.getByRole("button", { name: /linkedin/i });
    await userEvent.click(linkedInButton);

    const calledUrl = mockWindowOpen.mock.calls[0][0] as string;
    const decodedUrl = decodeURIComponent(calledUrl);
    expect(decodedUrl).toContain("source=linkedin");
  });

  test("opens sharing window when Facebook button is clicked", async () => {
    const mockWindowOpen = vi.spyOn(window, "open");
    render(<SocialMediaTab surveyUrl={mockSurveyUrl} surveyTitle={mockSurveyTitle} />);

    const facebookButton = screen.getByRole("button", { name: /facebook/i });
    await userEvent.click(facebookButton);

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining("facebook.com/sharer"),
      "share-dialog",
      "width=1024,height=768,location=no,toolbar=no,status=no,menubar=no,scrollbars=yes,resizable=yes,noopener=yes,noreferrer=yes"
    );
  });

  test("opens sharing window when X button is clicked", async () => {
    const mockWindowOpen = vi.spyOn(window, "open");
    render(<SocialMediaTab surveyUrl={mockSurveyUrl} surveyTitle={mockSurveyTitle} />);

    const xButton = screen.getByRole("button", { name: /^x$/i });
    await userEvent.click(xButton);

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining("twitter.com/intent/tweet"),
      "share-dialog",
      "width=1024,height=768,location=no,toolbar=no,status=no,menubar=no,scrollbars=yes,resizable=yes,noopener=yes,noreferrer=yes"
    );
  });

  test("encodes URLs and titles correctly for sharing", async () => {
    const specialCharUrl = "https://app.formbricks.com/s/survey1?param=test&other=value";
    const specialCharTitle = "Test Survey & More";
    const mockWindowOpen = vi.spyOn(window, "open");

    render(<SocialMediaTab surveyUrl={specialCharUrl} surveyTitle={specialCharTitle} />);

    const linkedInButton = screen.getByRole("button", { name: /linkedin/i });
    await userEvent.click(linkedInButton);

    const calledUrl = mockWindowOpen.mock.calls[0][0] as string;
    expect(calledUrl).toContain(encodeURIComponent(specialCharTitle));
  });
});
