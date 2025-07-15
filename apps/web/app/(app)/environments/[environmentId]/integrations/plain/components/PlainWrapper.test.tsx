import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationPlain } from "@formbricks/types/integration/plain";
import { TSurvey } from "@formbricks/types/surveys/types";
import { PlainWrapper } from "./PlainWrapper";

// Mock child components
vi.mock("@/modules/ui/components/connect-integration", () => ({
  ConnectIntegration: vi.fn(() => <div>Mocked ConnectIntegration</div>),
}));

vi.mock("./AddIntegrationModal", () => ({
  AddIntegrationModal: vi.fn(() => <div>Mocked AddIntegrationModal</div>),
}));

vi.mock("./AddKeyModal", () => ({
  AddKeyModal: vi.fn(() => <div>Mocked AddKeyModal</div>),
}));

vi.mock("./ManageIntegration", () => ({
  ManageIntegration: vi.fn(() => <div>Mocked ManageIntegration</div>),
}));

const mockEnvironment = {
  id: "test-env-id",
  name: "Test Environment",
} as unknown as TEnvironment;

const mockSurveys: TSurvey[] = [];

const mockPlainIntegration: TIntegrationPlain = {
  id: "integration-id",
  type: "plain",
  environmentId: "test-env-id",
  config: {
    key: "test-key",
    data: [],
  },
};

describe("PlainWrapper", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders ConnectIntegration when not connected", () => {
    render(
      <PlainWrapper
        plainIntegration={undefined}
        enabled={true}
        environment={mockEnvironment}
        webAppUrl="http://localhost:3000"
        surveys={mockSurveys}
        databasesArray={[]}
        locale="en-US"
      />
    );

    expect(screen.getByText("Mocked ConnectIntegration")).toBeInTheDocument();
    expect(screen.queryByText("Mocked ManageIntegration")).not.toBeInTheDocument();
  });

  test("renders ManageIntegration when connected", () => {
    render(
      <PlainWrapper
        plainIntegration={mockPlainIntegration}
        enabled={true}
        environment={mockEnvironment}
        webAppUrl="http://localhost:3000"
        surveys={mockSurveys}
        databasesArray={[]}
        locale="en-US"
      />
    );

    expect(screen.getByText("Mocked ManageIntegration")).toBeInTheDocument();
    expect(screen.queryByText("Mocked ConnectIntegration")).not.toBeInTheDocument();
  });
});
