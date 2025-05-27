import { createProjectAction } from "@/app/(app)/environments/[environmentId]/actions";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ProjectSettings } from "./ProjectSettings";

// Mocks before imports
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("@tolgee/react", () => ({ useTranslate: () => ({ t: (key: string) => key }) }));
vi.mock("react-hot-toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/app/(app)/environments/[environmentId]/actions", () => ({ createProjectAction: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({ getFormattedErrorMessage: () => "formatted-error" }));
vi.mock("@/modules/ui/components/color-picker", () => ({
  ColorPicker: ({ color, onChange }: any) => (
    <button data-testid="color-picker" onClick={() => onChange("#000")}>
      {color}
    </button>
  ),
}));
vi.mock("@/modules/ui/components/input", () => ({
  Input: ({ value, onChange, placeholder }: any) => (
    <input placeholder={placeholder} value={value} onChange={(e) => onChange((e.target as any).value)} />
  ),
}));
vi.mock("@/modules/ui/components/multi-select", () => ({
  MultiSelect: ({ value, options, onChange }: any) => (
    <select
      data-testid="multi-select"
      multiple
      value={value}
      onChange={(e) => onChange(Array.from((e.target as any).selectedOptions).map((o: any) => o.value))}>
      {options.map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("@/modules/ui/components/survey", () => ({
  SurveyInline: () => <div data-testid="survey-inline" />,
}));
vi.mock("@/lib/templates", () => ({ previewSurvey: () => ({}) }));
vi.mock("@/modules/ee/teams/team-list/components/create-team-modal", () => ({
  CreateTeamModal: ({ open }: any) => <div data-testid={open ? "team-modal-open" : "team-modal-closed"} />,
}));

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

describe("ProjectSettings component", () => {
  const baseProps = {
    organizationId: "org1",
    projectMode: "cx",
    industry: "ind",
    defaultBrandColor: "#fff",
    organizationTeams: [],
    canDoRoleManagement: false,
    userProjectsCount: 0,
  } as any;

  const fillAndSubmit = async () => {
    const nameInput = screen.getByPlaceholderText("e.g. Formbricks");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "TestProject");
    const nextButton = screen.getByRole("button", { name: "common.next" });
    await userEvent.click(nextButton);
  };

  test("successful createProject for link channel navigates to surveys and clears localStorage", async () => {
    (createProjectAction as any).mockResolvedValue({
      data: { environments: [{ id: "env123", type: "production" }] },
    });
    render(<ProjectSettings {...baseProps} channel="link" projectMode="cx" />);
    await fillAndSubmit();
    expect(createProjectAction).toHaveBeenCalledWith({
      organizationId: "org1",
      data: expect.objectContaining({ teamIds: [] }),
    });
    expect(pushMock).toHaveBeenCalledWith("/environments/env123/surveys");
    expect(localStorage.getItem("FORMBRICKS_SURVEYS_FILTERS_KEY_LS")).toBeNull();
  });

  test("successful createProject for app channel navigates to connect", async () => {
    (createProjectAction as any).mockResolvedValue({
      data: { environments: [{ id: "env456", type: "production" }] },
    });
    render(<ProjectSettings {...baseProps} channel="app" projectMode="cx" />);
    await fillAndSubmit();
    expect(pushMock).toHaveBeenCalledWith("/environments/env456/connect");
  });

  test("successful createProject for cx mode navigates to xm-templates when channel is neither link nor app", async () => {
    (createProjectAction as any).mockResolvedValue({
      data: { environments: [{ id: "env789", type: "production" }] },
    });
    render(<ProjectSettings {...baseProps} channel="unknown" projectMode="cx" />);
    await fillAndSubmit();
    expect(pushMock).toHaveBeenCalledWith("/environments/env789/xm-templates");
  });

  test("shows error toast on createProject error response", async () => {
    (createProjectAction as any).mockResolvedValue({ error: "err" });
    render(<ProjectSettings {...baseProps} channel="link" projectMode="cx" />);
    await fillAndSubmit();
    expect(toast.error).toHaveBeenCalledWith("formatted-error");
  });

  test("shows error toast on exception", async () => {
    (createProjectAction as any).mockImplementation(() => {
      throw new Error("fail");
    });
    render(<ProjectSettings {...baseProps} channel="link" projectMode="cx" />);
    await fillAndSubmit();
    expect(toast.error).toHaveBeenCalledWith("organizations.projects.new.settings.project_creation_failed");
  });
});
