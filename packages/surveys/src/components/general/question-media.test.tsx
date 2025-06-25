import { convertToEmbedUrl } from "@/lib/video-upload";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { QuestionMedia } from "./question-media";

describe("QuestionMedia", () => {
  afterEach(() => {
    cleanup();
  });
  test("renders image correctly", () => {
    const imgUrl = "https://example.com/test.jpg";
    const altText = "Test Image";
    render(<QuestionMedia imgUrl={imgUrl} altText={altText} />);

    const img = screen.getByAltText(altText);
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe(imgUrl);
  });

  test("renders YouTube video correctly", () => {
    const videoUrl = "https://www.youtube.com/watch?v=test123";
    render(<QuestionMedia videoUrl={videoUrl} />);

    const iframe = screen.getByTitle("Question Video");
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute("src")).toBe(videoUrl + "?controls=0");
  });

  test("renders Vimeo video correctly", () => {
    const videoUrl = "https://vimeo.com/test123";
    render(<QuestionMedia videoUrl={videoUrl} />);

    const iframe = screen.getByTitle("Question Video");
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute("src")).toBe(
      videoUrl +
        "?title=false&transcript=false&speed=false&quality_selector=false&progress_bar=false&pip=false&fullscreen=false&cc=false&chromecast=false"
    );
  });

  test("renders Loom video correctly", () => {
    const videoUrl = "https://www.loom.com/share/test123";
    render(<QuestionMedia videoUrl={videoUrl} />);

    const iframe = screen.getByTitle("Question Video");
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute("src")).toBe(
      videoUrl + "?hide_share=true&hideEmbedTopBar=true&hide_title=true"
    );
  });

  test("renders loading state initially", () => {
    const { container } = render(<QuestionMedia imgUrl="https://example.com/test.jpg" />);

    const loadingElement = container.querySelector(".fb-animate-pulse");
    expect(loadingElement).toBeTruthy();
  });

  test("renders expand button with correct link", () => {
    const imgUrl = "https://example.com/test.jpg";
    render(<QuestionMedia imgUrl={imgUrl} />);

    const expandLink = screen.getByRole("link");
    expect(expandLink).toBeTruthy();
    expect(expandLink.getAttribute("href")).toBe(imgUrl);
    expect(expandLink.getAttribute("target")).toBe("_blank");
    expect(expandLink.getAttribute("rel")).toBe("noreferrer");
  });

  test("handles loading completion", async () => {
    const imgUrl = "https://example.com/test.jpg";
    const { container } = render(<QuestionMedia imgUrl={imgUrl} />);

    const img = screen.getByAltText("Image");
    await img.dispatchEvent(new Event("load"));

    // Wait for state update
    await new Promise((resolve) => setTimeout(resolve, 0));

    const loadingElements = container.querySelectorAll(".fb-animate-pulse");
    expect(loadingElements.length).toBe(0);
  });

  test("renders nothing when no media URLs are provided", () => {
    const { container } = render(<QuestionMedia />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
  });

  test("uses default alt text when not provided", () => {
    const imgUrl = "https://example.com/test.jpg";
    render(<QuestionMedia imgUrl={imgUrl} />);

    const img = screen.getByAltText("Image");
    expect(img).toBeTruthy();
  });

  test("handles video loading state", async () => {
    const videoUrl = "https://www.youtube.com/watch?v=test123";
    const { container } = render(<QuestionMedia videoUrl={videoUrl} />);

    // Check loading state is initially shown
    const loadingElement = container.querySelector(".fb-animate-pulse");
    expect(loadingElement).toBeTruthy();

    // Get iframe and trigger load
    const iframe = screen.getByTitle("Question Video");
    await iframe.dispatchEvent(new Event("load"));

    // Wait for state update
    await new Promise((resolve) => setTimeout(resolve, 0));

    const loadingElements = container.querySelectorAll(".fb-animate-pulse");
    expect(loadingElements.length).toBe(0);
  });

  test("renders expand button with correct video link", () => {
    const videoUrl = "https://www.youtube.com/watch?v=test123";
    render(<QuestionMedia videoUrl={videoUrl} />);

    const expandLink = screen.getByRole("link");
    expect(expandLink).toBeTruthy();
    expect(expandLink.getAttribute("href")).toBe(convertToEmbedUrl(videoUrl));
    expect(expandLink.getAttribute("target")).toBe("_blank");
    expect(expandLink.getAttribute("rel")).toBe("noreferrer");
  });

  test("handles regular video URL without parameters", () => {
    const videoUrl = "https://example.com/video.mp4";
    render(<QuestionMedia videoUrl={videoUrl} />);

    const iframe = screen.getByTitle("Question Video");
    expect(iframe.getAttribute("src")).toBe(videoUrl);
  });
});
