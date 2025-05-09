import { getActionClasses } from "@/lib/actionClass/service";
import { getEnvironments } from "@/lib/environment/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TEnvironmentAuth } from "@/modules/environments/types/environment-auth";
import { cleanup, render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TActionClass } from "@formbricks/types/action-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { TProject } from "@formbricks/types/project";
// Import the component after mocks
import Page from "./page";

// Mock dependencies
vi.mock("@/lib/actionClass/service", () => ({
  getActionClasses: vi.fn(),
}));
vi.mock("@/lib/environment/service", () => ({
  getEnvironments: vi.fn(),
}));
vi.mock("@/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn(),
}));
vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));
vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("@/app/(app)/environments/[environmentId]/actions/components/ActionClassesTable", () => ({
  ActionClassesTable: ({ children }) => <div>ActionClassesTable Mock{children}</div>,
}));
vi.mock("@/app/(app)/environments/[environmentId]/actions/components/ActionRowData", () => ({
  ActionClassDataRow: ({ actionClass }) => <div>ActionClassDataRow Mock: {actionClass.name}</div>,
}));
vi.mock("@/app/(app)/environments/[environmentId]/actions/components/ActionTableHeading", () => ({
  ActionTableHeading: () => <div>ActionTableHeading Mock</div>,
}));
vi.mock("@/app/(app)/environments/[environmentId]/actions/components/AddActionModal", () => ({
  AddActionModal: () => <div>AddActionModal Mock</div>,
}));
vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }) => <div>PageContentWrapper Mock{children}</div>,
}));
vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ pageTitle, cta }) => (
    <div>
      PageHeader Mock: {pageTitle} {cta && <div>CTA Mock</div>}
    </div>
  ),
}));

// Mock data
const mockEnvironmentId = "test-env-id";
const mockProjectId = "test-project-id";
const mockEnvironment = {
  id: mockEnvironmentId,
  name: "Test Environment",
  type: "development",
} as unknown as TEnvironment;
const mockOtherEnvironment = {
  id: "other-env-id",
  name: "Other Environment",
  type: "production",
} as unknown as TEnvironment;
const mockProject = { id: mockProjectId, name: "Test Project" } as unknown as TProject;
const mockActionClasses = [
  { id: "action1", name: "Action 1", type: "code", environmentId: mockEnvironmentId } as TActionClass,
  { id: "action2", name: "Action 2", type: "noCode", environmentId: mockEnvironmentId } as TActionClass,
];
const mockOtherEnvActionClasses = [
  { id: "action3", name: "Action 3", type: "code", environmentId: mockOtherEnvironment.id } as TActionClass,
];
const mockLocale = "en-US";

const mockParams = { environmentId: mockEnvironmentId };
const mockProps = { params: mockParams };

describe("Actions Page", () => {
  beforeEach(() => {
    vi.mocked(getActionClasses)
      .mockResolvedValueOnce(mockActionClasses) // First call for current env
      .mockResolvedValueOnce(mockOtherEnvActionClasses); // Second call for other env
    vi.mocked(getEnvironments).mockResolvedValue([mockEnvironment, mockOtherEnvironment]);
    vi.mocked(findMatchingLocale).mockResolvedValue(mockLocale);
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  test("renders the page correctly with actions", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      isReadOnly: false,
      project: mockProject,
      isBilling: false,
      environment: mockEnvironment,
    } as TEnvironmentAuth);

    const PageComponent = await Page(mockProps);
    render(PageComponent);

    expect(screen.getByText("PageHeader Mock: common.actions")).toBeInTheDocument();
    expect(screen.getByText("CTA Mock")).toBeInTheDocument(); // AddActionModal rendered via CTA
    expect(screen.getByText("ActionClassesTable Mock")).toBeInTheDocument();
    expect(screen.getByText("ActionTableHeading Mock")).toBeInTheDocument();
    expect(screen.getByText("ActionClassDataRow Mock: Action 1")).toBeInTheDocument();
    expect(screen.getByText("ActionClassDataRow Mock: Action 2")).toBeInTheDocument();
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });

  test("redirects if isBilling is true", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      isReadOnly: false,
      project: mockProject,
      isBilling: true,
      environment: mockEnvironment,
    } as TEnvironmentAuth);

    await Page(mockProps);

    expect(vi.mocked(redirect)).toHaveBeenCalledWith(`/environments/${mockEnvironmentId}/settings/billing`);
  });

  test("does not render AddActionModal CTA if isReadOnly is true", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      isReadOnly: true,
      project: mockProject,
      isBilling: false,
      environment: mockEnvironment,
    } as TEnvironmentAuth);

    const PageComponent = await Page(mockProps);
    render(PageComponent);

    expect(screen.getByText("PageHeader Mock: common.actions")).toBeInTheDocument();
    expect(screen.queryByText("CTA Mock")).not.toBeInTheDocument(); // CTA should not be present
    expect(screen.getByText("ActionClassesTable Mock")).toBeInTheDocument();
  });

  test("renders AddActionModal CTA if isReadOnly is false", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      isReadOnly: false,
      project: mockProject,
      isBilling: false,
      environment: mockEnvironment,
    } as TEnvironmentAuth);

    const PageComponent = await Page(mockProps);
    render(PageComponent);

    expect(screen.getByText("PageHeader Mock: common.actions")).toBeInTheDocument();
    expect(screen.getByText("CTA Mock")).toBeInTheDocument(); // CTA should be present
    expect(screen.getByText("ActionClassesTable Mock")).toBeInTheDocument();
  });
});
