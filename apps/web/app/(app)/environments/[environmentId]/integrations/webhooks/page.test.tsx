import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import WebhooksPage from "./page";

vi.mock("@/modules/integrations/webhooks/page", () => ({
  WebhooksPage: vi.fn(() => <div>WebhooksPageMock</div>),
}));

describe("WebhooksIntegrationPage", () => {
  test("renders WebhooksPage component", () => {
    render(<WebhooksPage params={{ environmentId: "test-env-id" }} />);
    expect(WebhooksPage).toHaveBeenCalled();
  });
});
