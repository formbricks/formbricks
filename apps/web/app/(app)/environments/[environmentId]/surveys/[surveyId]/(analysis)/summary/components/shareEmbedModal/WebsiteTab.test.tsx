import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { WebsiteTab } from "./WebsiteTab";

// Mock child components and hooks
const mockAdvancedOptionToggle = vi.fn();
vi.mock("@/modules/ui/components/advanced-option-toggle", () => ({
  AdvancedOptionToggle: (props: any) => {
    mockAdvancedOptionToggle(props);
    return (
      <div data-testid="advanced-option-toggle">
        <span>{props.title}</span>
        <input type="checkbox" checked={props.isChecked} onChange={() => props.onToggle(!props.isChecked)} />
      </div>
    );
  },
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

const mockCodeBlock = vi.fn();
vi.mock("@/modules/ui/components/code-block", () => ({
  CodeBlock: (props: any) => {
    mockCodeBlock(props);
    return (
      <div data-testid="code-block" data-language={props.language}>
        {props.children}
      </div>
    );
  },
}));

const mockOptionsSwitch = vi.fn();
vi.mock("@/modules/ui/components/options-switch", () => ({
  OptionsSwitch: (props: any) => {
    mockOptionsSwitch(props);
    return (
      <div data-testid="options-switch">
        {props.options.map((opt: { value: string; label: string }) => (
          <button key={opt.value} onClick={() => props.handleOptionChange(opt.value)}>
            {opt.label}
          </button>
        ))}
      </div>
    );
  },
}));

vi.mock("lucide-react", () => ({
  CopyIcon: () => <div data-testid="copy-icon" />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, target }: { children: React.ReactNode; href: string; target?: string }) => (
    <a href={href} target={target} data-testid="next-link">
      {children}
    </a>
  ),
}));

const mockWriteText = vi.fn();
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: mockWriteText,
  },
  configurable: true,
});

const surveyUrl = "https://app.formbricks.com/s/survey123";
const environmentId = "env456";

describe("WebsiteTab", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders OptionsSwitch and StaticTab by default", () => {
    render(<WebsiteTab surveyUrl={surveyUrl} environmentId={environmentId} />);
    expect(screen.getByTestId("options-switch")).toBeInTheDocument();
    expect(mockOptionsSwitch).toHaveBeenCalledWith(
      expect.objectContaining({
        currentOption: "static",
        options: [
          { value: "static", label: "environments.surveys.summary.static_iframe" },
          { value: "popup", label: "environments.surveys.summary.dynamic_popup" },
        ],
      })
    );
    // StaticTab content checks
    expect(screen.getByText("common.copy_code")).toBeInTheDocument();
    expect(screen.getByTestId("code-block")).toBeInTheDocument();
    expect(screen.getByTestId("advanced-option-toggle")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.static_iframe")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.dynamic_popup")).toBeInTheDocument();
  });

  test("switches to PopupTab when 'Dynamic Popup' option is clicked", async () => {
    render(<WebsiteTab surveyUrl={surveyUrl} environmentId={environmentId} />);
    const popupButton = screen.getByRole("button", {
      name: "environments.surveys.summary.dynamic_popup",
    });
    await userEvent.click(popupButton);

    expect(mockOptionsSwitch.mock.calls.some((call) => call[0].currentOption === "popup")).toBe(true);
    // PopupTab content checks
    expect(screen.getByText("environments.surveys.summary.embed_pop_up_survey_title")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.setup_instructions")).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument(); // Check for the ol element

    const listItems = screen.getAllByRole("listitem");
    expect(listItems[0]).toHaveTextContent(
      "common.follow_these environments.surveys.summary.setup_instructions environments.surveys.summary.to_connect_your_website_with_formbricks"
    );
    expect(listItems[1]).toHaveTextContent(
      "environments.surveys.summary.make_sure_the_survey_type_is_set_to common.website_survey"
    );
    expect(listItems[2]).toHaveTextContent(
      "environments.surveys.summary.define_when_and_where_the_survey_should_pop_up"
    );

    expect(
      screen.getByRole("link", { name: "environments.surveys.summary.setup_instructions" })
    ).toHaveAttribute("href", `/environments/${environmentId}/project/website-connection`);
    expect(
      screen.getByText("environments.surveys.summary.unsupported_video_tag_warning").closest("video")
    ).toBeInTheDocument();
  });

  describe("StaticTab", () => {
    const formattedBaseCode = `<div style="position: relative; height:80dvh; overflow:auto;"> \n  <iframe \n    src="${surveyUrl}" \n    frameborder="0" style="position: absolute; left:0; top:0; width:100%; height:100%; border:0;">\n  </iframe>\n</div>`;
    const normalizedBaseCode = `<div style="position: relative; height:80dvh; overflow:auto;"> <iframe src="${surveyUrl}" frameborder="0" style="position: absolute; left:0; top:0; width:100%; height:100%; border:0;"> </iframe> </div>`;

    const formattedEmbedCode = `<div style="position: relative; height:80dvh; overflow:auto;"> \n  <iframe \n    src="${surveyUrl}?embed=true" \n    frameborder="0" style="position: absolute; left:0; top:0; width:100%; height:100%; border:0;">\n  </iframe>\n</div>`;
    const normalizedEmbedCode = `<div style="position: relative; height:80dvh; overflow:auto;"> <iframe src="${surveyUrl}?embed=true" frameborder="0" style="position: absolute; left:0; top:0; width:100%; height:100%; border:0;"> </iframe> </div>`;

    test("renders correctly with initial iframe code and embed mode toggle", () => {
      render(<WebsiteTab surveyUrl={surveyUrl} environmentId={environmentId} />); // Defaults to StaticTab

      expect(screen.getByTestId("code-block")).toHaveTextContent(normalizedBaseCode);
      expect(mockCodeBlock).toHaveBeenCalledWith(
        expect.objectContaining({ children: formattedBaseCode, language: "html" })
      );

      expect(screen.getByTestId("advanced-option-toggle")).toBeInTheDocument();
      expect(mockAdvancedOptionToggle).toHaveBeenCalledWith(
        expect.objectContaining({
          isChecked: false,
          title: "environments.surveys.summary.embed_mode",
          description: "environments.surveys.summary.embed_mode_description",
        })
      );
      expect(screen.getByText("environments.surveys.summary.embed_mode")).toBeInTheDocument();
    });

    test("copies iframe code to clipboard when 'Copy Code' is clicked", async () => {
      render(<WebsiteTab surveyUrl={surveyUrl} environmentId={environmentId} />);
      const copyButton = screen.getByRole("button", { name: "Embed survey in your website" });

      await userEvent.click(copyButton);

      expect(mockWriteText).toHaveBeenCalledWith(formattedBaseCode);
      expect(toast.success).toHaveBeenCalledWith(
        "environments.surveys.summary.embed_code_copied_to_clipboard"
      );
      expect(screen.getByText("common.copy_code")).toBeInTheDocument();
    });

    test("updates iframe code when 'Embed Mode' is toggled", async () => {
      render(<WebsiteTab surveyUrl={surveyUrl} environmentId={environmentId} />);
      const embedToggle = screen
        .getByTestId("advanced-option-toggle")
        .querySelector('input[type="checkbox"]');
      expect(embedToggle).not.toBeNull();

      await userEvent.click(embedToggle!);

      expect(screen.getByTestId("code-block")).toHaveTextContent(normalizedEmbedCode);
      expect(mockCodeBlock.mock.calls.find((call) => call[0].children === formattedEmbedCode)).toBeTruthy();
      expect(mockAdvancedOptionToggle.mock.calls.some((call) => call[0].isChecked === true)).toBe(true);

      // Toggle back
      await userEvent.click(embedToggle!);
      expect(screen.getByTestId("code-block")).toHaveTextContent(normalizedBaseCode);
      expect(mockCodeBlock.mock.calls.find((call) => call[0].children === formattedBaseCode)).toBeTruthy();
      expect(mockAdvancedOptionToggle.mock.calls.some((call) => call[0].isChecked === false)).toBe(true);
    });
  });

  describe("PopupTab", () => {
    beforeEach(async () => {
      // Ensure PopupTab is active
      render(<WebsiteTab surveyUrl={surveyUrl} environmentId={environmentId} />);
      const popupButton = screen.getByRole("button", {
        name: "environments.surveys.summary.dynamic_popup",
      });
      await userEvent.click(popupButton);
    });

    test("renders title and instructions", () => {
      expect(screen.getByText("environments.surveys.summary.embed_pop_up_survey_title")).toBeInTheDocument();

      const listItems = screen.getAllByRole("listitem");
      expect(listItems).toHaveLength(3);
      expect(listItems[0]).toHaveTextContent(
        "common.follow_these environments.surveys.summary.setup_instructions environments.surveys.summary.to_connect_your_website_with_formbricks"
      );
      expect(listItems[1]).toHaveTextContent(
        "environments.surveys.summary.make_sure_the_survey_type_is_set_to common.website_survey"
      );
      expect(listItems[2]).toHaveTextContent(
        "environments.surveys.summary.define_when_and_where_the_survey_should_pop_up"
      );

      // Specific checks for elements or distinct text content
      expect(screen.getByText("environments.surveys.summary.setup_instructions")).toBeInTheDocument(); // Checks the link text
      expect(screen.getByText("common.website_survey")).toBeInTheDocument(); // Checks the bold text
      // The text for the last list item is its sole content, so getByText works here.
      expect(
        screen.getByText("environments.surveys.summary.define_when_and_where_the_survey_should_pop_up")
      ).toBeInTheDocument();
    });

    test("renders the setup instructions link with correct href", () => {
      const link = screen.getByRole("link", { name: "environments.surveys.summary.setup_instructions" });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", `/environments/${environmentId}/project/website-connection`);
      expect(link).toHaveAttribute("target", "_blank");
    });

    test("renders the video", () => {
      const videoElement = screen
        .getByText("environments.surveys.summary.unsupported_video_tag_warning")
        .closest("video");
      expect(videoElement).toBeInTheDocument();
      expect(videoElement).toHaveAttribute("autoPlay");
      expect(videoElement).toHaveAttribute("loop");
      const sourceElement = videoElement?.querySelector("source");
      expect(sourceElement).toHaveAttribute("src", "/video/tooltips/change-survey-type.mp4");
      expect(sourceElement).toHaveAttribute("type", "video/mp4");
      expect(
        screen.getByText("environments.surveys.summary.unsupported_video_tag_warning")
      ).toBeInTheDocument();
    });
  });
});
