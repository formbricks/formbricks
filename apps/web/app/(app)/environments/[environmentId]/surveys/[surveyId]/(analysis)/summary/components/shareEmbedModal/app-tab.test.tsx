import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AppTab } from "./app-tab";

vi.mock("@/modules/ui/components/options-switch", () => ({
  OptionsSwitch: (props: {
    options: Array<{ value: string; label: string }>;
    handleOptionChange: (value: string) => void;
  }) => (
    <div data-testid="options-switch">
      {props.options.map((option) => (
        <button
          key={option.value}
          data-testid={`option-${option.value}`}
          onClick={() => props.handleOptionChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/MobileAppTab",
  () => ({
    MobileAppTab: () => <div data-testid="mobile-app-tab">MobileAppTab</div>,
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/WebAppTab",
  () => ({
    WebAppTab: () => <div data-testid="web-app-tab">WebAppTab</div>,
  })
);

describe("AppTab", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders correctly by default with WebAppTab visible", () => {
    render(<AppTab />);
    expect(screen.getByTestId("options-switch")).toBeInTheDocument();
    expect(screen.getByTestId("option-webapp")).toBeInTheDocument();
    expect(screen.getByTestId("option-mobile")).toBeInTheDocument();

    expect(screen.getByTestId("web-app-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-app-tab")).not.toBeInTheDocument();
  });

  test("switches to MobileAppTab when mobile option is selected", async () => {
    const user = userEvent.setup();
    render(<AppTab />);

    const mobileOptionButton = screen.getByTestId("option-mobile");
    await user.click(mobileOptionButton);

    expect(screen.getByTestId("mobile-app-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("web-app-tab")).not.toBeInTheDocument();
  });
});
