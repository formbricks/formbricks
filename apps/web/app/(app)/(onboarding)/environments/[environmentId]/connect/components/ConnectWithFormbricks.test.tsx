import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ConnectWithFormbricks } from "./ConnectWithFormbricks";

// Mocks before import
const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("@tolgee/react", () => ({ useTranslate: () => ({ t: (key: string) => key }) }));
vi.mock("next/navigation", () => ({ useRouter: vi.fn(() => ({ push: pushMock, refresh: refreshMock })) }));
vi.mock("./OnboardingSetupInstructions", () => ({
  OnboardingSetupInstructions: () => <div data-testid="instructions" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConnectWithFormbricks", () => {
  const environment = { id: "env1" } as any;
  const webAppUrl = "http://app";
  const channel = {} as any;

  test("renders waiting state when widgetSetupCompleted is false", () => {
    render(
      <ConnectWithFormbricks
        environment={environment}
        webAppUrl={webAppUrl}
        widgetSetupCompleted={false}
        channel={channel}
      />
    );
    expect(screen.getByTestId("instructions")).toBeInTheDocument();
    expect(screen.getByText("environments.connect.waiting_for_your_signal")).toBeInTheDocument();
  });

  test("renders success state when widgetSetupCompleted is true", () => {
    render(
      <ConnectWithFormbricks
        environment={environment}
        webAppUrl={webAppUrl}
        widgetSetupCompleted={true}
        channel={channel}
      />
    );
    expect(screen.getByText("environments.connect.congrats")).toBeInTheDocument();
    expect(screen.getByText("environments.connect.connection_successful_message")).toBeInTheDocument();
  });

  test("clicking finish button navigates to surveys", async () => {
    render(
      <ConnectWithFormbricks
        environment={environment}
        webAppUrl={webAppUrl}
        widgetSetupCompleted={true}
        channel={channel}
      />
    );
    const button = screen.getByRole("button", { name: "environments.connect.finish_onboarding" });
    await userEvent.click(button);
    expect(pushMock).toHaveBeenCalledWith(`/environments/${environment.id}/surveys`);
  });

  test("refresh is called on visibilitychange to visible", () => {
    render(
      <ConnectWithFormbricks
        environment={environment}
        webAppUrl={webAppUrl}
        widgetSetupCompleted={false}
        channel={channel}
      />
    );
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(refreshMock).toHaveBeenCalled();
  });
});
