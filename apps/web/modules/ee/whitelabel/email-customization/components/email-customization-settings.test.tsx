import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TOrganization } from "@formbricks/types/organizations";
import type { TUser } from "@formbricks/types/user";
import { EmailCustomizationSettings } from "./email-customization-settings";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  removeOrganizationEmailLogo: vi.fn(),
  sendOrganizationTestEmail: vi.fn(),
  updateOrganizationEmailLogo: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- a plain stand-in for next/image
  default: ({ unoptimized: _unoptimized, ...props }: Record<string, unknown>) => <img {...props} />,
}));
vi.mock("react-hot-toast", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock("@/modules/ee/whitelabel/email-customization/lib/api-client", () => ({
  removeOrganizationEmailLogo: mocks.removeOrganizationEmailLogo,
  sendOrganizationTestEmail: mocks.sendOrganizationTestEmail,
  updateOrganizationEmailLogo: mocks.updateOrganizationEmailLogo,
}));
vi.mock("@/modules/storage/file-upload", () => ({ handleFileUpload: vi.fn() }));

const FB_LOGO_URL = "https://app.example.com/logo-transparent.png";
const CUSTOM_LOGO_URL = "/storage/clp123456789012345678901234/public/logo.png";

const renderSettings = (whitelabel?: TOrganization["whitelabel"]) =>
  render(
    <EmailCustomizationSettings
      organization={{ id: "clg123456789012345678901234", whitelabel } as TOrganization}
      hasWhiteLabelPermission
      workspaceId="clp123456789012345678901234"
      isReadOnly={false}
      isFormbricksCloud={false}
      user={{ name: "Ada" } as TUser}
      fbLogoUrl={FB_LOGO_URL}
      isStorageConfigured
      enterpriseLicenseRequestFormUrl="https://example.com/license"
    />
  );

const previewImage = () => screen.queryByTestId("email-customization-preview-image");

describe("EmailCustomizationSettings logo (ENG-545)", () => {
  beforeEach(() => {
    mocks.removeOrganizationEmailLogo.mockResolvedValue(undefined);
    mocks.sendOrganizationTestEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("previews the Formbricks logo for an organization that never touched the setting", () => {
    renderSettings(undefined);

    expect(previewImage()).toHaveAttribute("src", FB_LOGO_URL);
  });

  test("previews the organization's own logo", () => {
    renderSettings({ logoUrl: CUSTOM_LOGO_URL });

    expect(previewImage()).toHaveAttribute("src", CUSTOM_LOGO_URL);
  });

  test("Remove logo asks first, and Cancel changes nothing", () => {
    renderSettings({ logoUrl: CUSTOM_LOGO_URL });

    fireEvent.click(screen.getByTestId("remove-logo-button"));

    expect(screen.getByText("workspace.look.remove_logo_confirmation")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));

    expect(mocks.removeOrganizationEmailLogo).not.toHaveBeenCalled();
    expect(previewImage()).toHaveAttribute("src", CUSTOM_LOGO_URL);
    expect(screen.getByTestId("remove-logo-button")).toBeInTheDocument();
  });

  test.each([
    ["the Formbricks logo", undefined],
    ["a custom logo", { logoUrl: CUSTOM_LOGO_URL }],
  ])(
    "confirming removes %s for good: persisted, toasted, refreshed, and gone from the preview",
    async (_label, whitelabel) => {
      renderSettings(whitelabel);

      fireEvent.click(screen.getByTestId("remove-logo-button"));
      fireEvent.click(screen.getByRole("button", { name: "common.delete" }));

      await waitFor(() =>
        expect(mocks.removeOrganizationEmailLogo).toHaveBeenCalledWith("clg123456789012345678901234")
      );
      await waitFor(() =>
        expect(mocks.toastSuccess).toHaveBeenCalledWith(
          "workspace.settings.general.logo_removed_successfully"
        )
      );
      expect(mocks.refresh).toHaveBeenCalled();
      expect(previewImage()).not.toBeInTheDocument();
      expect(screen.queryByTestId("remove-logo-button")).not.toBeInTheDocument();
    }
  );

  test("keeps the logo when removing it fails", async () => {
    mocks.removeOrganizationEmailLogo.mockRejectedValue(new Error("boom"));
    renderSettings({ logoUrl: CUSTOM_LOGO_URL });

    fireEvent.click(screen.getByTestId("remove-logo-button"));
    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(previewImage()).toHaveAttribute("src", CUSTOM_LOGO_URL);
  });

  test("a removed logo stays removed on reload, and the test email still goes out", async () => {
    renderSettings({ logoUrl: null, hideLogo: true });

    expect(previewImage()).not.toBeInTheDocument();
    expect(screen.queryByTestId("remove-logo-button")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("send-test-email-button"));

    await waitFor(() =>
      expect(mocks.sendOrganizationTestEmail).toHaveBeenCalledWith("clg123456789012345678901234")
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
