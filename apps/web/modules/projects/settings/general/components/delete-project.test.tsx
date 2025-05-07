import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getUserProjects } from "@/lib/project/service";
import { cleanup, render, screen } from "@testing-library/react";
import { getServerSession } from "next-auth";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";
import { DeleteProject } from "./delete-project";

vi.mock("@/modules/projects/settings/general/components/delete-project-render", () => ({
  DeleteProjectRender: (props: any) => (
    <div data-testid="delete-project-render">
      <p>isDeleteDisabled: {String(props.isDeleteDisabled)}</p>
      <p>isOwnerOrManager: {String(props.isOwnerOrManager)}</p>
    </div>
  ),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

const mockProject = {
  id: "proj-1",
  name: "Project 1",
  createdAt: new Date(),
  updatedAt: new Date(),
  organizationId: "org-1",
  environments: [],
} as any;

const mockOrganization = {
  id: "org-1",
  name: "Org 1",
  createdAt: new Date(),
  updatedAt: new Date(),
  billing: { plan: "free" } as any,
} as any;

vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(() => {
    // Return a mock translator that just returns the key
    return (key: string) => key;
  }),
}));
vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));
vi.mock("@/lib/organization/service", () => ({
  getOrganizationByEnvironmentId: vi.fn(),
}));
vi.mock("@/lib/project/service", () => ({
  getUserProjects: vi.fn(),
}));

describe("/modules/projects/settings/general/components/delete-project.tsx", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue({
      expires: new Date(Date.now() + 3600 * 1000).toISOString(),
      user: { id: "user1" },
    });
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization);
    vi.mocked(getUserProjects).mockResolvedValue([mockProject, { ...mockProject, id: "proj-2" }]);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders DeleteProjectRender with correct props when delete is enabled", async () => {
    const result = await DeleteProject({
      environmentId: "env-1",
      currentProject: mockProject,
      organizationProjects: [mockProject, { ...mockProject, id: "proj-2" }],
      isOwnerOrManager: true,
    });
    render(result);
    const el = screen.getByTestId("delete-project-render");
    expect(el).toBeInTheDocument();
    expect(screen.getByText("isDeleteDisabled: false")).toBeInTheDocument();
    expect(screen.getByText("isOwnerOrManager: true")).toBeInTheDocument();
  });

  test("renders DeleteProjectRender with delete disabled if only one project", async () => {
    vi.mocked(getUserProjects).mockResolvedValue([mockProject]);
    const result = await DeleteProject({
      environmentId: "env-1",
      currentProject: mockProject,
      organizationProjects: [mockProject],
      isOwnerOrManager: true,
    });
    render(result);
    const el = screen.getByTestId("delete-project-render");
    expect(el).toBeInTheDocument();
    expect(screen.getByText("isDeleteDisabled: true")).toBeInTheDocument();
  });

  test("renders DeleteProjectRender with delete disabled if not owner or manager", async () => {
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization);
    vi.mocked(getUserProjects).mockResolvedValue([mockProject, { ...mockProject, id: "proj-2" }]);
    const result = await DeleteProject({
      environmentId: "env-1",
      currentProject: mockProject,
      organizationProjects: [mockProject, { ...mockProject, id: "proj-2" }],
      isOwnerOrManager: false,
    });
    render(result);
    const el = screen.getByTestId("delete-project-render");
    expect(el).toBeInTheDocument();
    expect(screen.getByText("isDeleteDisabled: true")).toBeInTheDocument();
    expect(screen.getByText("isOwnerOrManager: false")).toBeInTheDocument();
  });

  test("throws error if session is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    await expect(
      DeleteProject({
        environmentId: "env-1",
        currentProject: mockProject,
        organizationProjects: [mockProject],
        isOwnerOrManager: true,
      })
    ).rejects.toThrow("common.session_not_found");
  });

  test("throws error if organization is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(null);
    await expect(
      DeleteProject({
        environmentId: "env-1",
        currentProject: mockProject,
        organizationProjects: [mockProject],
        isOwnerOrManager: true,
      })
    ).rejects.toThrow("common.organization_not_found");
  });
});
