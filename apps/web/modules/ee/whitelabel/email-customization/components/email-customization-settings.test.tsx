import { handleFileUpload } from "@/app/lib/fileUpload";
import {
  removeOrganizationEmailLogoUrlAction,
  sendTestEmailAction,
  updateOrganizationEmailLogoUrlAction,
} from "@/modules/ee/whitelabel/email-customization/actions";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import { EmailCustomizationSettings } from "./email-customization-settings";

vi.mock("@/modules/ee/whitelabel/email-customization/actions", () => ({
  removeOrganizationEmailLogoUrlAction: vi.fn(),
  sendTestEmailAction: vi.fn(),
  updateOrganizationEmailLogoUrlAction: vi.fn(),
}));

vi.mock("@/app/lib/fileUpload", () => ({
  handleFileUpload: vi.fn(),
}));

const defaultProps = {
  organization: {
    id: "org-123",
    whitelabel: {
      logoUrl: "https://example.com/current-logo.png",
    },
    billing: {
      plan: "enterprise",
    },
  } as TOrganization,
  hasWhiteLabelPermission: true,
  environmentId: "env-123",
  isReadOnly: false,
  isFormbricksCloud: false,
  user: {
    id: "user-123",
    name: "Test User",
  } as TUser,
  fbLogoUrl: "https://example.com/fallback-logo.png",
};

describe("EmailCustomizationSettings", () => {
  beforeEach(() => {
    cleanup();
  });

  test("renders the logo if one is set and shows Replace/Remove buttons", () => {
    render(<EmailCustomizationSettings {...defaultProps} />);

    const logoImage = screen.getByTestId("email-customization-preview-image");

    expect(logoImage).toBeInTheDocument();

    const srcUrl = new URL(logoImage.getAttribute("src")!, window.location.origin);
    const originalUrl = srcUrl.searchParams.get("url");
    expect(originalUrl).toBe("https://example.com/current-logo.png");

    // Since a logo is present, the “Replace Logo” and “Remove Logo” buttons should appear
    expect(screen.getByTestId("replace-logo-button")).toBeInTheDocument();
    expect(screen.getByTestId("remove-logo-button")).toBeInTheDocument();
  });

  test("calls removeOrganizationEmailLogoUrlAction when removing logo", async () => {
    vi.mocked(removeOrganizationEmailLogoUrlAction).mockResolvedValue({
      data: true,
    });

    render(<EmailCustomizationSettings {...defaultProps} />);

    const user = userEvent.setup();
    const removeButton = screen.getByTestId("remove-logo-button");
    await user.click(removeButton);

    expect(removeOrganizationEmailLogoUrlAction).toHaveBeenCalledTimes(1);
    expect(removeOrganizationEmailLogoUrlAction).toHaveBeenCalledWith({
      organizationId: "org-123",
    });
  });

  test("calls updateOrganizationEmailLogoUrlAction after uploading and clicking save", async () => {
    vi.mocked(handleFileUpload).mockResolvedValueOnce({
      url: "https://example.com/new-uploaded-logo.png",
    });
    vi.mocked(updateOrganizationEmailLogoUrlAction).mockResolvedValue({
      data: true,
    });

    render(<EmailCustomizationSettings {...defaultProps} />);

    const user = userEvent.setup();

    // 1. Replace the logo by uploading a new file
    const fileInput = screen.getAllByTestId("upload-file-input");
    const testFile = new File(["dummy content"], "test-image.png", { type: "image/png" });
    await user.upload(fileInput[0], testFile);

    // 2. Click “Save”
    const saveButton = screen.getAllByRole("button", { name: /save/i });
    await user.click(saveButton[0]);

    // The component calls `uploadFile` then `updateOrganizationEmailLogoUrlAction`
    expect(handleFileUpload).toHaveBeenCalledWith(testFile, "env-123", ["jpeg", "png", "jpg", "webp"]);
    expect(updateOrganizationEmailLogoUrlAction).toHaveBeenCalledWith({
      organizationId: "org-123",
      logoUrl: "https://example.com/new-uploaded-logo.png",
    });
  });

  test("sends test email if a logo is saved and the user clicks 'Send Test Email'", async () => {
    vi.mocked(sendTestEmailAction).mockResolvedValue({
      data: { success: true },
    });

    render(<EmailCustomizationSettings {...defaultProps} />);

    const user = userEvent.setup();
    const testEmailButton = screen.getByTestId("send-test-email-button");
    await user.click(testEmailButton);

    expect(sendTestEmailAction).toHaveBeenCalledWith({
      organizationId: "org-123",
    });
  });

  test("displays upgrade prompt if hasWhiteLabelPermission is false", () => {
    render(<EmailCustomizationSettings {...defaultProps} hasWhiteLabelPermission={false} />);
    // Check for text about upgrading
    expect(screen.getByText(/customize_email_with_a_higher_plan/i)).toBeInTheDocument();
  });

  test("shows read-only warning if isReadOnly is true", () => {
    render(<EmailCustomizationSettings {...defaultProps} isReadOnly />);

    expect(
      screen.getByText(/only_owners_managers_and_manage_access_members_can_perform_this_action/i)
    ).toBeInTheDocument();
  });
});
