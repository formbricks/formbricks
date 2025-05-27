import { SurveyType } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TProjectStyling } from "@formbricks/types/project";
import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { MediaBackground } from ".";

// Mock dependencies
vi.mock("next/image", () => ({
  default: ({ src, alt, onLoadingComplete }: any) => {
    // Call onLoadingComplete to simulate image load
    if (onLoadingComplete) setTimeout(() => onLoadingComplete(), 0);
    return <img src={src} alt={alt} data-testid="next-image" />;
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

describe("MediaBackground", () => {
  const defaultProps = {
    styling: {
      background: {
        bgType: "color",
        bg: "#ffffff",
        brightness: 100,
      },
    } as TProjectStyling,
    surveyType: "app" as SurveyType,
    children: <div data-testid="child-content">Test Content</div>,
  };

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  test("renders with color background", () => {
    render(<MediaBackground {...defaultProps} />);

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    const backgroundDiv = document.querySelector(".absolute.inset-0");
    expect(backgroundDiv).toHaveStyle("background-color: #ffffff");
  });

  test("renders with image background", () => {
    const props = {
      ...defaultProps,
      styling: {
        background: {
          bgType: "image",
          bg: "/test-image.jpg",
          brightness: 90,
        },
      } as TProjectStyling,
    };

    render(<MediaBackground {...props} />);

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByTestId("next-image")).toHaveAttribute("src", "/test-image.jpg");
  });

  test("renders with Unsplash image background with author attribution", () => {
    const unsplashImageUrl =
      "https://unsplash.com/photos/test?authorName=John%20Doe&authorLink=https://unsplash.com/@johndoe";
    const props = {
      ...defaultProps,
      styling: {
        background: {
          bgType: "image",
          bg: unsplashImageUrl,
          brightness: 100,
        },
      } as TProjectStyling,
    };

    render(<MediaBackground {...props} />);

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByTestId("next-image")).toHaveAttribute("src", unsplashImageUrl);
    expect(screen.getByText("common.photo_by")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  test("renders with upload background", () => {
    const props = {
      ...defaultProps,
      styling: {
        background: {
          bgType: "upload",
          bg: "/uploads/test-image.jpg",
          brightness: 100,
        },
      } as TProjectStyling,
    };

    render(<MediaBackground {...props} />);

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByTestId("next-image")).toHaveAttribute("src", "/uploads/test-image.jpg");
  });

  test("renders error message when image not found", () => {
    const props = {
      ...defaultProps,
      styling: {
        background: {
          bgType: "image",
          bg: "",
          brightness: 100,
        },
      } as TProjectStyling,
    };

    render(<MediaBackground {...props} />);

    expect(screen.getByText("common.no_background_image_found")).toBeInTheDocument();
  });

  test("renders mobile preview", () => {
    const props = {
      ...defaultProps,
      isMobilePreview: true,
    };

    render(<MediaBackground {...props} />);

    const mobileContainer = document.querySelector(".w-\\[22rem\\]");
    expect(mobileContainer).toBeInTheDocument();
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  test("renders editor view", () => {
    const props = {
      ...defaultProps,
      isEditorView: true,
    };

    render(<MediaBackground {...props} />);

    const editorContainer = document.querySelector(".rounded-b-lg");
    expect(editorContainer).toBeInTheDocument();
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  test("calls onBackgroundLoaded when background is loaded", () => {
    const onBackgroundLoaded = vi.fn();
    const props = {
      ...defaultProps,
      onBackgroundLoaded,
    };

    render(<MediaBackground {...props} />);

    // For color backgrounds, it should be called immediately
    expect(onBackgroundLoaded).toHaveBeenCalledWith(true);
  });

  test("renders animation background", () => {
    // Mock HTMLMediaElement.prototype methods
    Object.defineProperty(window.HTMLMediaElement.prototype, "muted", {
      set: vi.fn(),
      configurable: true,
    });

    const props = {
      ...defaultProps,
      styling: {
        background: {
          bgType: "animation",
          bg: "/test-animation.mp4",
          brightness: 100,
        },
      } as TProjectStyling,
    };

    render(<MediaBackground {...props} />);

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    const videoElement = document.querySelector("video");
    expect(videoElement).toBeInTheDocument();
    expect(videoElement?.querySelector("source")).toHaveAttribute("src", "/test-animation.mp4");
  });

  test("applies correct brightness filter", () => {
    const props = {
      ...defaultProps,
      styling: {
        background: {
          bgType: "color",
          bg: "#ffffff",
          brightness: 80,
        },
      } as TSurveyStyling,
    };

    render(<MediaBackground {...props} />);

    const backgroundDiv = document.querySelector(".absolute.inset-0");
    expect(backgroundDiv).toHaveStyle("filter: brightness(80%)");
  });
});
