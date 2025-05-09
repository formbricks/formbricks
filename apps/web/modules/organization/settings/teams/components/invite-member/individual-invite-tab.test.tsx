import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { IndividualInviteTab } from "./individual-invite-tab";

const t = (k: string) => k;
vi.mock("@tolgee/react", () => ({ useTranslate: () => ({ t }) }));

vi.mock("@/modules/ee/role-management/components/add-member-role", () => ({
  AddMemberRole: () => <div data-testid="add-member-role">AddMemberRole</div>,
}));

vi.mock("@/modules/ui/components/multi-select", () => ({
  MultiSelect: ({ value, options, onChange, disabled }: any) => (
    <select
      data-testid="multi-select"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange([e.target.value])}>
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

const defaultProps = {
  setOpen: vi.fn(),
  onSubmit: vi.fn(),
  teams: [
    { id: "team-1", name: "Team 1" },
    { id: "team-2", name: "Team 2" },
  ],
  canDoRoleManagement: true,
  isFormbricksCloud: true,
  environmentId: "env-1",
  membershipRole: "owner" as TOrganizationRole,
};

describe("IndividualInviteTab", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders form fields and buttons", () => {
    render(<IndividualInviteTab {...defaultProps} />);
    expect(screen.getByLabelText("common.full_name")).toBeInTheDocument();
    expect(screen.getByLabelText("common.email")).toBeInTheDocument();
    expect(screen.getByTestId("add-member-role")).toBeInTheDocument();
    expect(screen.getByText("common.cancel")).toBeInTheDocument();
    expect(screen.getByText("common.invite")).toBeInTheDocument();
  });

  test("submits valid form and calls onSubmit", async () => {
    render(<IndividualInviteTab {...defaultProps} />);
    await userEvent.type(screen.getByLabelText("common.full_name"), "Test User");
    await userEvent.type(screen.getByLabelText("common.email"), "test@example.com");
    fireEvent.submit(screen.getByRole("button", { name: "common.invite" }).closest("form")!);
    await waitFor(() =>
      expect(defaultProps.onSubmit).toHaveBeenCalledWith([
        expect.objectContaining({ name: "Test User", email: "test@example.com", role: "member" }),
      ])
    );
    expect(defaultProps.setOpen).toHaveBeenCalledWith(false);
  });

  test("shows error for empty name", async () => {
    render(<IndividualInviteTab {...defaultProps} />);
    await userEvent.type(screen.getByLabelText("common.email"), "test@example.com");
    fireEvent.submit(screen.getByRole("button", { name: "common.invite" }).closest("form")!);
    expect(await screen.findByText("Name should be at least 1 character long")).toBeInTheDocument();
  });

  test("shows error for invalid email", async () => {
    render(<IndividualInviteTab {...defaultProps} />);
    await userEvent.type(screen.getByLabelText("common.full_name"), "Test User");
    await userEvent.type(screen.getByLabelText("common.email"), "not-an-email");
    fireEvent.submit(screen.getByRole("button", { name: "common.invite" }).closest("form")!);
    expect(await screen.findByText(/Invalid email/)).toBeInTheDocument();
  });

  test("shows member role info alert when role is member", async () => {
    render(<IndividualInviteTab {...defaultProps} canDoRoleManagement={true} />);
    await userEvent.type(screen.getByLabelText("common.full_name"), "Test User");
    await userEvent.type(screen.getByLabelText("common.email"), "test@example.com");
    // Simulate selecting member role
    // Not needed as default is member if canDoRoleManagement is true
    expect(screen.getByText("environments.settings.teams.member_role_info_message")).toBeInTheDocument();
  });

  test("shows team select when canDoRoleManagement is true", () => {
    render(<IndividualInviteTab {...defaultProps} canDoRoleManagement={true} />);
    expect(screen.getByTestId("multi-select")).toBeInTheDocument();
  });

  test("shows upgrade alert when canDoRoleManagement is false", () => {
    render(<IndividualInviteTab {...defaultProps} canDoRoleManagement={false} />);
    expect(screen.getByText("environments.settings.teams.upgrade_plan_notice_message")).toBeInTheDocument();
    expect(screen.getByText("common.start_free_trial")).toBeInTheDocument();
  });

  test("shows team select placeholder and message when no teams", () => {
    render(<IndividualInviteTab {...defaultProps} teams={[]} />);
    expect(screen.getByText("environments.settings.teams.create_first_team_message")).toBeInTheDocument();
  });

  test("cancel button closes modal", async () => {
    render(<IndividualInviteTab {...defaultProps} />);
    userEvent.click(screen.getByText("common.cancel"));
    await waitFor(() => expect(defaultProps.setOpen).toHaveBeenCalledWith(false));
  });
});
