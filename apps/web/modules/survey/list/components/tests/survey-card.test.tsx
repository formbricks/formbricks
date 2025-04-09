import { TSurvey } from "@/modules/survey/list/types/surveys";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SurveyCard } from "../survey-card";

// Mock constants
vi.mock("@formbricks/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  ENCRYPTION_KEY: "test",
  WEBAPP_URL: "mock-webapp-url",
  AI_AZURE_LLM_RESSOURCE_NAME: "mock-azure-llm-resource-name",
  AI_AZURE_LLM_API_KEY: "mock-azure-llm-api-key",
  AI_AZURE_LLM_DEPLOYMENT_ID: "mock-azure-llm-deployment-id",
  AI_AZURE_EMBEDDINGS_RESSOURCE_NAME: "mock-azure-embeddings-resource-name",
  AI_AZURE_EMBEDDINGS_API_KEY: "mock-azure-embeddings-api-key",
  AI_AZURE_EMBEDDINGS_DEPLOYMENT_ID: "mock-azure-embeddings-deployment-id",
  IS_PRODUCTION: true,
  FB_LOGO_URL: "https://example.com/mock-logo.png",
  SMTP_HOST: "mock-smtp-host",
  SMTP_PORT: "mock-smtp-port",
}));

describe("SurveyCard", () => {
  const dummySurvey = {
    id: "survey123",
    name: "Test Survey",
    status: "draft",
    responseCount: 0,
    type: "link",
    createdAt: new Date().toString(),
    updatedAt: new Date().toString(),
  };
  const environmentId = "env123";
  const WEBAPP_URL = "http://example.com";
  const mockDeleteSurvey = vi.fn();
  const mockDuplicateSurvey = vi.fn();

  afterEach(() => {
    cleanup();
  });

  it("renders survey card with a draft link when not readOnly", () => {
    render(
      // ...existing code for test wrapper if needed...
      <SurveyCard
        survey={{ ...dummySurvey, status: "draft" } as unknown as TSurvey}
        environmentId={environmentId}
        isReadOnly={false}
        surveyDomain={WEBAPP_URL}
        duplicateSurvey={mockDuplicateSurvey}
        deleteSurvey={mockDeleteSurvey}
      />
    );
    // Draft survey => link should point to edit
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/environments/${environmentId}/engagements/${dummySurvey.id}/edit`);
  });

  it("displays no clickable link when readOnly and survey is draft", () => {
    render(
      <SurveyCard
        survey={{ ...dummySurvey, status: "draft" } as unknown as TSurvey}
        environmentId={environmentId}
        isReadOnly={true}
        surveyDomain={WEBAPP_URL}
        duplicateSurvey={mockDuplicateSurvey}
        deleteSurvey={mockDeleteSurvey}
      />
    );
    // When it's read only and draft, we expect no link
    const link = screen.queryByRole("link");
    expect(link).toBeNull();
  });

  it("renders summary link when survey status is not draft", () => {
    render(
      <SurveyCard
        survey={{ ...dummySurvey, status: "inProgress" } as unknown as TSurvey}
        environmentId={environmentId}
        isReadOnly={false}
        surveyDomain={WEBAPP_URL}
        duplicateSurvey={mockDuplicateSurvey}
        deleteSurvey={mockDeleteSurvey}
      />
    );
    // For non-draft => link to summary
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      `/environments/${environmentId}/engagements/${dummySurvey.id}/summary`
    );
  });
});
