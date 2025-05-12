import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Home, Settings } from "lucide-react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { OnboardingOptionsContainer } from "./OnboardingOptionsContainer";

describe("OnboardingOptionsContainer", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders options with links", () => {
    const options = [
      {
        title: "Test Option",
        description: "Test Description",
        icon: Home,
        href: "/test",
      },
    ];

    render(<OnboardingOptionsContainer options={options} />);
    expect(screen.getByText("Test Option")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
  });

  test("renders options with onClick handler", () => {
    const onClickMock = vi.fn();
    const options = [
      {
        title: "Click Option",
        description: "Click Description",
        icon: Home,
        onClick: onClickMock,
      },
    ];

    render(<OnboardingOptionsContainer options={options} />);
    expect(screen.getByText("Click Option")).toBeInTheDocument();
    expect(screen.getByText("Click Description")).toBeInTheDocument();
  });

  test("renders options with iconText", () => {
    const options = [
      {
        title: "Icon Text Option",
        description: "Icon Text Description",
        icon: Home,
        iconText: "Custom Icon Text",
      },
    ];

    render(<OnboardingOptionsContainer options={options} />);
    expect(screen.getByText("Custom Icon Text")).toBeInTheDocument();
  });

  test("renders options with loading state", () => {
    const options = [
      {
        title: "Loading Option",
        description: "Loading Description",
        icon: Home,
        isLoading: true,
      },
    ];

    render(<OnboardingOptionsContainer options={options} />);
    expect(screen.getByText("Loading Option")).toBeInTheDocument();
  });

  test("renders multiple options", () => {
    const options = [
      {
        title: "First Option",
        description: "First Description",
        icon: Home,
      },
      {
        title: "Second Option",
        description: "Second Description",
        icon: Settings,
      },
    ];

    render(<OnboardingOptionsContainer options={options} />);
    expect(screen.getByText("First Option")).toBeInTheDocument();
    expect(screen.getByText("Second Option")).toBeInTheDocument();
  });

  test("calls onClick handler when clicking an option", async () => {
    const onClickMock = vi.fn();
    const options = [
      {
        title: "Click Option",
        description: "Click Description",
        icon: Home,
        onClick: onClickMock,
      },
    ];

    render(<OnboardingOptionsContainer options={options} />);
    await userEvent.click(screen.getByText("Click Option"));
    expect(onClickMock).toHaveBeenCalledTimes(1);
  });
});
