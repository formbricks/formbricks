import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { IntegrationsTip } from "./IntegrationsTip";

vi.mock("@/modules/ui/components/icons", () => ({
  SlackIcon: () => <div data-testid="slack-icon" />,
}));

const mockT = vi.fn((key) => key);
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: mockT,
  }),
}));

const environmentId = "test-env-id";

describe("IntegrationsTip", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders the component with correct text and link", () => {
    render(<IntegrationsTip environmentId={environmentId} />);

    expect(screen.getByTestId("slack-icon")).toBeInTheDocument();
    expect(
      screen.getByText("environments.settings.notifications.need_slack_or_discord_notifications?")
    ).toBeInTheDocument();

    const linkElement = screen.getByText("environments.settings.notifications.use_the_integration");
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute("href", `/environments/${environmentId}/integrations`);
  });
});
