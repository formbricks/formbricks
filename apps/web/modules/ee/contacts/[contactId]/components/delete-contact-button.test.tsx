import { deleteContactAction } from "@/modules/ee/contacts/actions";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTranslate } from "@tolgee/react";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DeleteContactButton } from "./delete-contact-button";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/actions", () => ({
  deleteContactAction: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn((result: any) => {
    if (result.serverError) return result.serverError;
    if (result.validationErrors) {
      return Object.entries(result.validationErrors)
        .map(([key, value]: [string, any]) => {
          if (key === "_errors") return Array.isArray(value) ? value.join(", ") : "";
          return `${key}${value?._errors?.join(", ") || ""}`;
        })
        .join("\n");
    }
    return "Unknown error";
  }),
}));

describe("DeleteContactButton", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockRouter: Partial<AppRouterInstance> = {
    refresh: vi.fn(),
    push: vi.fn(),
  };

  const mockTranslate = {
    t: vi.fn((key) => key),
    isLoading: false,
  };

  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue(mockRouter as AppRouterInstance);
    vi.mocked(useTranslate).mockReturnValue(mockTranslate);
  });

  test("should not render when isReadOnly is true", () => {
    render(<DeleteContactButton environmentId="env-123" contactId="contact-123" isReadOnly={true} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("should render delete button when isReadOnly is false", () => {
    render(<DeleteContactButton environmentId="env-123" contactId="contact-123" isReadOnly={false} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  test("should open delete dialog when clicking delete button", async () => {
    const user = userEvent.setup();
    render(<DeleteContactButton environmentId="env-123" contactId="contact-123" isReadOnly={false} />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByText("common.delete person")).toBeInTheDocument();
  });

  test("should handle successful contact deletion", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteContactAction).mockResolvedValue({
      data: {
        environmentId: "env-123",
        id: "contact-123",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    render(<DeleteContactButton environmentId="env-123" contactId="contact-123" isReadOnly={false} />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("common.delete"));

    expect(deleteContactAction).toHaveBeenCalledWith({ contactId: "contact-123" });
    expect(mockRouter.refresh).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith("/environments/env-123/contacts");
    expect(toast.success).toHaveBeenCalledWith("environments.contacts.contact_deleted_successfully");
  });

  test("should handle failed contact deletion", async () => {
    const user = userEvent.setup();
    const errorResponse = {
      serverError: "Failed to delete contact",
    };
    vi.mocked(deleteContactAction).mockResolvedValue(errorResponse);

    render(<DeleteContactButton environmentId="env-123" contactId="contact-123" isReadOnly={false} />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("common.delete"));

    expect(deleteContactAction).toHaveBeenCalledWith({ contactId: "contact-123" });
    expect(toast.error).toHaveBeenCalledWith("Failed to delete contact");
  });
});
