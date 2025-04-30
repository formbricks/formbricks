import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { triggerDownloadUnsplashImageAction } from "../actions";
import { ImageFromUnsplashSurveyBg } from "./unsplash-images";

vi.mock("@/lib/env", () => ({
  env: {
    IS_FORMBRICKS_CLOUD: "0",
    FORMBRICKS_API_HOST: "mock-api-host",
    FORMBRICKS_ENVIRONMENT_ID: "mock-environment-id",
  },
}));

vi.mock("../actions", () => ({
  getImagesFromUnsplashAction: vi.fn(),
  triggerDownloadUnsplashImageAction: vi.fn(),
}));

vi.mock("react-hot-toast");

describe("ImageFromUnsplashSurveyBg", () => {
  afterEach(() => {
    cleanup();
  });

  test("should render default images when no query is provided", () => {
    const handleBgChange = vi.fn();
    render(<ImageFromUnsplashSurveyBg handleBgChange={handleBgChange} />);

    const images = screen.getAllByRole("img");
    // The number of default images is 13 as defined in the component
    expect(images.length).toBe(13);
  });

  test("should call handleBgChange with the correct parameters when an image is selected", async () => {
    const handleBgChange = vi.fn();
    render(<ImageFromUnsplashSurveyBg handleBgChange={handleBgChange} />);

    const image = screen.getAllByRole("img")[0];
    // The first default image is dogs.webp
    const expectedImageUrl = "/image-backgrounds/dogs.webp";

    await userEvent.click(image);

    expect(handleBgChange).toHaveBeenCalledTimes(1);
    expect(handleBgChange).toHaveBeenCalledWith(expectedImageUrl, "image");
  });

  test("should focus the search input on render", () => {
    const handleBgChange = vi.fn();
    render(<ImageFromUnsplashSurveyBg handleBgChange={handleBgChange} />);
    const input = screen.getByPlaceholderText("environments.surveys.edit.try_lollipop_or_mountain");
    expect(input).toHaveFocus();
  });

  test("handleImageSelected calls handleBgChange with the image URL and does not call triggerDownloadUnsplashImageAction when downloadImageUrl is undefined", async () => {
    const handleBgChange = vi.fn();

    vi.mock("../actions", () => ({
      getImagesFromUnsplashAction: vi.fn(),
      triggerDownloadUnsplashImageAction: vi.fn(),
    }));

    render(<ImageFromUnsplashSurveyBg handleBgChange={handleBgChange} />);

    const imageUrl = "/image-backgrounds/dogs.webp";

    // Find the image element.  Using `getAllByRole` and targeting the first image, since we know default images are rendered.
    const image = screen.getAllByRole("img")[0];

    // Simulate a click on the image.
    await userEvent.click(image);

    // Assert that handleBgChange is called with the correct URL.
    expect(handleBgChange).toHaveBeenCalledWith(imageUrl, "image");

    // Assert that triggerDownloadUnsplashImageAction is not called.
    expect(triggerDownloadUnsplashImageAction).not.toHaveBeenCalled();
  });

  test("handles malformed URLs gracefully", async () => {
    const handleBgChange = vi.fn();
    const malformedURL = "not a valid URL";
    const mockImages = [
      {
        id: "1",
        alt_description: "Image 1",
        urls: {
          regularWithAttribution: malformedURL,
        },
      },
    ];

    vi.mocked(toast.error).mockImplementation((_: string) => "");

    const actions = await import("../actions");
    vi.mocked(actions.getImagesFromUnsplashAction).mockResolvedValue({ data: mockImages });

    render(<ImageFromUnsplashSurveyBg handleBgChange={handleBgChange} />);

    // Wait for the component to finish loading images
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(toast.error).not.toHaveBeenCalled();
  });
});
