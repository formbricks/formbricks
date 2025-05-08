import { createSurveyAction } from "@/modules/survey/components/template-list/actions";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { XMTemplateList } from "./XMTemplateList";

// Prepare push mock and module mocks before importing component
const pushMock = vi.fn();
vi.mock("@tolgee/react", () => ({ useTranslate: () => ({ t: (key: string) => key }) }));
vi.mock("next/navigation", () => ({ useRouter: vi.fn(() => ({ push: pushMock })) }));
vi.mock("react-hot-toast", () => ({ default: { error: vi.fn() } }));
vi.mock("@/app/(app)/(onboarding)/environments/[environmentId]/xm-templates/lib/xm-templates", () => ({
  getXMTemplates: (t: any) => [
    { id: 1, name: "tmpl1" },
    { id: 2, name: "tmpl2" },
  ],
}));
vi.mock("@/app/(app)/(onboarding)/environments/[environmentId]/xm-templates/lib/utils", () => ({
  replacePresetPlaceholders: (template: any, project: any) => ({ ...template, projectId: project.id }),
}));
vi.mock("@/modules/survey/components/template-list/actions", () => ({ createSurveyAction: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({ getFormattedErrorMessage: () => "formatted-error" }));
vi.mock("@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer", () => ({
  OnboardingOptionsContainer: ({ options }: { options: any[] }) => (
    <div>
      {options.map((opt, idx) => (
        <button key={idx} data-testid={`option-${idx}`} onClick={opt.onClick}>
          {opt.title}
        </button>
      ))}
    </div>
  ),
}));

// Reset mocks between tests
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("XMTemplateList component", () => {
  const project = { id: "proj1" } as any;
  const user = { id: "user1" } as any;
  const environmentId = "env1";

  test("creates survey and navigates on success", async () => {
    // Mock successful survey creation
    vi.mocked(createSurveyAction).mockResolvedValue({ data: { id: "survey1" } } as any);

    render(<XMTemplateList project={project} user={user} environmentId={environmentId} />);

    const option0 = screen.getByTestId("option-0");
    await userEvent.click(option0);

    expect(createSurveyAction).toHaveBeenCalledWith({
      environmentId,
      surveyBody: expect.objectContaining({ id: 1, projectId: "proj1", type: "link", createdBy: "user1" }),
    });
    expect(pushMock).toHaveBeenCalledWith(`/environments/${environmentId}/surveys/survey1/edit?mode=cx`);
  });

  test("shows error toast on failure", async () => {
    // Mock failed survey creation
    vi.mocked(createSurveyAction).mockResolvedValue({ error: "err" } as any);

    render(<XMTemplateList project={project} user={user} environmentId={environmentId} />);

    const option1 = screen.getByTestId("option-1");
    await userEvent.click(option1);

    expect(createSurveyAction).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("formatted-error");
  });
});
