import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { VideoSettings } from "./video-settings";

// Mock dependencies
vi.mock("@/lib/utils/videoUpload", () => ({
  checkForYoutubeUrl: vi.fn().mockImplementation((url) => {
    return url.includes("youtube") || url.includes("youtu.be");
  }),
  convertToEmbedUrl: vi.fn().mockImplementation((url) => {
    if (url.includes("youtube") || url.includes("youtu.be")) {
      return "https://www.youtube.com/embed/VIDEO_ID";
    }
    if (url.includes("vimeo")) {
      return "https://player.vimeo.com/video/VIDEO_ID";
    }
    if (url.includes("loom")) {
      return "https://www.loom.com/embed/VIDEO_ID";
    }
    return null;
  }),
  extractYoutubeId: vi.fn().mockReturnValue("VIDEO_ID"),
}));

vi.mock("../lib/utils", () => ({
  checkForYoutubePrivacyMode: vi.fn().mockImplementation((url) => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.host === "youtube-nocookie.com";
    } catch (e) {
      return false; // Return false if the URL is invalid
    }
  }),
}));

// Mock toast to avoid errors
vi.mock("react-hot-toast", () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe("VideoSettings", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders input field with provided URL", () => {
    const mockProps = {
      uploadedVideoUrl: "https://www.youtube.com/watch?v=VIDEO_ID",
      setUploadedVideoUrl: vi.fn(),
      onFileUpload: vi.fn(),
      videoUrl: "",
      setVideoUrlTemp: vi.fn(),
    };

    render(<VideoSettings {...mockProps} />);

    const inputElement = screen.getByPlaceholderText("https://www.youtube.com/watch?v=VIDEO_ID");
    expect(inputElement).toBeInTheDocument();
    expect(inputElement).toHaveValue("https://www.youtube.com/watch?v=VIDEO_ID");
  });

  test("renders Add button when URL is provided but not matching videoUrl", () => {
    const mockProps = {
      uploadedVideoUrl: "https://www.youtube.com/watch?v=NEW_VIDEO_ID",
      setUploadedVideoUrl: vi.fn(),
      onFileUpload: vi.fn(),
      videoUrl: "https://www.youtube.com/watch?v=OLD_VIDEO_ID",
      setVideoUrlTemp: vi.fn(),
    };

    render(<VideoSettings {...mockProps} />);

    expect(screen.getByText("common.add")).toBeInTheDocument();
  });

  test("renders Remove button when URL matches videoUrl", () => {
    const testUrl = "https://www.youtube.com/watch?v=SAME_VIDEO_ID";
    const mockProps = {
      uploadedVideoUrl: testUrl,
      setUploadedVideoUrl: vi.fn(),
      onFileUpload: vi.fn(),
      videoUrl: testUrl,
      setVideoUrlTemp: vi.fn(),
    };

    render(<VideoSettings {...mockProps} />);

    expect(screen.getByText("common.remove")).toBeInTheDocument();
  });

  test("Add button is disabled when URL is empty", () => {
    const mockProps = {
      uploadedVideoUrl: "",
      setUploadedVideoUrl: vi.fn(),
      onFileUpload: vi.fn(),
      videoUrl: "",
      setVideoUrlTemp: vi.fn(),
    };

    render(<VideoSettings {...mockProps} />);

    const addButton = screen.getByText("common.add");
    expect(addButton).toBeDisabled();
  });

  test("calls setVideoUrlTemp and onFileUpload when Remove button is clicked", async () => {
    const user = userEvent.setup();
    const testUrl = "https://www.youtube.com/watch?v=VIDEO_ID";
    const mockProps = {
      uploadedVideoUrl: testUrl,
      setUploadedVideoUrl: vi.fn(),
      onFileUpload: vi.fn(),
      videoUrl: testUrl,
      setVideoUrlTemp: vi.fn(),
    };

    render(<VideoSettings {...mockProps} />);

    const removeButton = screen.getByText("common.remove");
    await user.click(removeButton);

    expect(mockProps.setVideoUrlTemp).toHaveBeenCalledWith("");
    expect(mockProps.setUploadedVideoUrl).toHaveBeenCalledWith("");
    expect(mockProps.onFileUpload).toHaveBeenCalledWith([], "video");
  });

  test("displays platform warning for unsupported URLs", async () => {
    const user = userEvent.setup();
    const mockProps = {
      uploadedVideoUrl: "",
      setUploadedVideoUrl: vi.fn(),
      onFileUpload: vi.fn(),
      videoUrl: "",
      setVideoUrlTemp: vi.fn(),
    };

    render(<VideoSettings {...mockProps} />);

    const input = screen.getByPlaceholderText("https://www.youtube.com/watch?v=VIDEO_ID");
    await user.type(input, "https://unsupported-platform.com/video");

    expect(screen.getByText("environments.surveys.edit.invalid_video_url_warning")).toBeInTheDocument();
  });
});
