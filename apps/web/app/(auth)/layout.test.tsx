import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppLayout from "../(auth)/layout";

vi.mock("@formbricks/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  IS_INTERCOM_CONFIGURED: true,
  INTERCOM_SECRET_KEY: "mock-intercom-secret-key",
  INTERCOM_APP_ID: "mock-intercom-app-id",
}));

vi.mock("@/app/intercom/IntercomClientWrapper", () => ({
  IntercomClientWrapper: () => <div data-testid="mock-intercom-wrapper" />,
}));
vi.mock("@/modules/ui/components/no-mobile-overlay", () => ({
  NoMobileOverlay: () => <div data-testid="mock-no-mobile-overlay" />,
}));

describe("(auth) AppLayout", () => {
  it("renders the NoMobileOverlay and IntercomClient, plus children", async () => {
    const appLayoutElement = await AppLayout({
      children: <div data-testid="child-content">Hello from children!</div>,
    });

    const childContentText = "Hello from children!";

    render(appLayoutElement);

    expect(screen.getByTestId("mock-no-mobile-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("mock-intercom-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("child-content")).toHaveTextContent(childContentText);
  });
});
