import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { CreateWithAIDialog } from "./create-with-ai-dialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
// The form and the Import dialog are their own units; only whether the hint shows is under test here.
vi.mock("@/modules/survey/components/template-list/components/create-with-ai-form", () => ({
  CreateWithAIForm: () => null,
}));
vi.mock("@/modules/survey/import/components/import-survey-dialog", () => ({
  ImportSurveyDialog: () => null,
}));

const renderDialog = (isAIAvailable: boolean) =>
  render(
    <CreateWithAIDialog
      workspaceId="clworkspace0000000000000001"
      language="en-US"
      isAIAvailable={isAIAvailable}
      open
      onOpenChange={vi.fn()}
    />
  );

describe("CreateWithAIDialog import hint", () => {
  test("points to the Import dialog for a Word, Excel or CSV questionnaire when AI is available", () => {
    renderDialog(true);

    expect(screen.getByText("workspace.surveys.ai_create.import_hint_link")).toBeInTheDocument();
  });

  test("is hidden without AI, where the Import dialog takes none of the files it names", () => {
    renderDialog(false);

    expect(screen.queryByText("workspace.surveys.ai_create.import_hint_link")).not.toBeInTheDocument();
  });
});
