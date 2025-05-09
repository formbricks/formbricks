import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/tolgee/server";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Loading from "./loading";

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(),
}));

vi.mock(
  "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar",
  () => ({
    OrganizationSettingsNavbar: vi.fn(() => <div>OrganizationSettingsNavbar</div>),
  })
);

vi.mock("@/app/(app)/components/LoadingCard", () => ({
  LoadingCard: vi.fn(({ title, description }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  )),
}));

describe("Loading", () => {
  const mockTranslate = vi.fn((key) => key);

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getTranslate).mockResolvedValue(mockTranslate);
  });

  test("renders loading state correctly", async () => {
    const LoadingComponent = await Loading();
    render(LoadingComponent);

    expect(screen.getByText("environments.settings.general.organization_settings")).toBeInTheDocument();
    expect(OrganizationSettingsNavbar).toHaveBeenCalledWith(
      {
        isFormbricksCloud: IS_FORMBRICKS_CLOUD,
        activeId: "general",
        loading: true,
      },
      undefined
    );

    expect(screen.getByText("environments.settings.general.organization_name")).toBeInTheDocument();
    expect(
      screen.getByText("environments.settings.general.organization_name_description")
    ).toBeInTheDocument();
    expect(screen.getByText("environments.settings.general.delete_organization")).toBeInTheDocument();
    expect(
      screen.getByText("environments.settings.general.delete_organization_description")
    ).toBeInTheDocument();
  });
});
