import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AnimatedSurveyBg } from "./animated-survey-bg";

describe("AnimatedSurveyBg", () => {
  afterEach(() => {
    cleanup();
  });

  test("should initialize animation state with the background prop", () => {
    const mockHandleBgChange = vi.fn();
    const backgroundValue = "/animated-bgs/4K/1_4k.mp4";

    render(<AnimatedSurveyBg handleBgChange={mockHandleBgChange} background={backgroundValue} />);

    const checkbox = screen.getByRole("checkbox", {
      checked: true,
    });

    expect(checkbox).toBeInTheDocument();
  });

  test("should update animation state and call handleBgChange with correct arguments when a thumbnail is clicked", async () => {
    const handleBgChange = vi.fn();
    const initialBackground = "/animated-bgs/4K/1_4k.mp4";
    const { container } = render(
      <AnimatedSurveyBg handleBgChange={handleBgChange} background={initialBackground} />
    );

    // Find the first video element and simulate a click on its parent button
    const videoElement = container.querySelector("video");
    const parentButton = videoElement?.closest("button");

    if (parentButton) {
      await userEvent.click(parentButton);

      const expectedValue = "/animated-bgs/4K/1_4k.mp4";

      expect(handleBgChange).toHaveBeenCalledWith(expectedValue, "animation");
    } else {
      throw new Error("Could not find the parent div of the video element.");
    }
  });

  test("should update animation state when the checkbox is clicked", () => {
    const mockHandleBgChange = vi.fn();
    const initialBackground = "/animated-bgs/4K/1_4k.mp4";

    render(<AnimatedSurveyBg handleBgChange={mockHandleBgChange} background={initialBackground} />);

    const checkbox = screen.getAllByRole("checkbox")[1];
    expect(checkbox).toBeInTheDocument();

    fireEvent.click(checkbox);

    expect(mockHandleBgChange).toHaveBeenCalled();
  });

  test("handles rejected Promise from video.play()", async () => {
    const mockHandleBgChange = vi.fn();
    const backgroundValue = "/animated-bgs/4K/1_4k.mp4";

    // Mock the video element and its play method to reject the promise
    const mockVideo = {
      play: vi.fn(() => Promise.reject(new Error("Playback failed"))),
      pause: vi.fn(),
      load: vi.fn(),
    };

    vi.spyOn(document, "getElementById").mockImplementation((id) => {
      if (id.startsWith("video-")) {
        return mockVideo as unknown as HTMLVideoElement;
      }
      return null;
    });

    render(<AnimatedSurveyBg handleBgChange={mockHandleBgChange} background={backgroundValue} />);

    // Simulate a mouse enter event on the first video thumbnail
    const firstThumbnail = screen.getAllByRole("checkbox")[0].closest("button"); // Find the parent button
    if (firstThumbnail) {
      fireEvent.mouseEnter(firstThumbnail);
    }

    // Wait for a short period to allow the debounced function to execute
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Assert that video.play() was called and rejected
    expect(mockVideo.play).toHaveBeenCalled();
  });
});
