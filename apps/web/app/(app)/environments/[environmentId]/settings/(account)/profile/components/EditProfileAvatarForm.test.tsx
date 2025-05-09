import * as profileActions from "@/app/(app)/environments/[environmentId]/settings/(account)/profile/actions";
import * as fileUploadHooks from "@/app/lib/fileUpload";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Session } from "next-auth";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EditProfileAvatarForm } from "./EditProfileAvatarForm";

vi.mock("@/modules/ui/components/avatars", () => ({
  ProfileAvatar: ({ imageUrl }) => <div data-testid="profile-avatar">{imageUrl || "No Avatar"}</div>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/(app)/environments/[environmentId]/settings/(account)/profile/actions", () => ({
  updateAvatarAction: vi.fn(),
  removeAvatarAction: vi.fn(),
}));

vi.mock("@/app/lib/fileUpload", () => ({
  handleFileUpload: vi.fn(),
}));

const mockSession: Session = {
  user: { id: "user-id" },
  expires: "session-expires-at",
};
const environmentId = "test-env-id";

describe("EditProfileAvatarForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.mocked(profileActions.updateAvatarAction).mockResolvedValue({});
    vi.mocked(profileActions.removeAvatarAction).mockResolvedValue({});
    vi.mocked(fileUploadHooks.handleFileUpload).mockResolvedValue({
      url: "new-avatar.jpg",
      error: undefined,
    });
  });

  test("renders correctly without an existing image", () => {
    render(<EditProfileAvatarForm session={mockSession} environmentId={environmentId} imageUrl={null} />);
    expect(screen.getByTestId("profile-avatar")).toHaveTextContent("No Avatar");
    expect(screen.getByText("environments.settings.profile.upload_image")).toBeInTheDocument();
    expect(screen.queryByText("environments.settings.profile.remove_image")).not.toBeInTheDocument();
  });

  test("renders correctly with an existing image", () => {
    render(
      <EditProfileAvatarForm
        session={mockSession}
        environmentId={environmentId}
        imageUrl="existing-avatar.jpg"
      />
    );
    expect(screen.getByTestId("profile-avatar")).toHaveTextContent("existing-avatar.jpg");
    expect(screen.getByText("environments.settings.profile.change_image")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.profile.remove_image")).toBeInTheDocument();
  });

  test("handles image removal successfully", async () => {
    render(
      <EditProfileAvatarForm
        session={mockSession}
        environmentId={environmentId}
        imageUrl="existing-avatar.jpg"
      />
    );
    const removeButton = screen.getByText("environments.settings.profile.remove_image");
    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(profileActions.removeAvatarAction).toHaveBeenCalledWith({ environmentId });
    });
  });

  test("shows error if removeAvatarAction fails", async () => {
    vi.mocked(profileActions.removeAvatarAction).mockRejectedValue(new Error("API error"));
    render(
      <EditProfileAvatarForm
        session={mockSession}
        environmentId={environmentId}
        imageUrl="existing-avatar.jpg"
      />
    );
    const removeButton = screen.getByText("environments.settings.profile.remove_image");
    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "environments.settings.profile.avatar_update_failed"
      );
    });
  });
});
