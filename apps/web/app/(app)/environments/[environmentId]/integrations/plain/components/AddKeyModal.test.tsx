import { AddKeyModal } from "@/app/(app)/environments/[environmentId]/integrations/plain/components/AddKeyModal";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { type Mock, beforeEach, describe, expect, test, vi } from "vitest";
import { connectPlainIntegrationAction } from "../actions";

vi.mock("../actions", () => ({
  connectPlainIntegrationAction: vi.fn(),
}));

vi.mock("react-hot-toast");

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

describe("AddKeyModal", () => {
  const environmentId = "test-environment-id";
  const setOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should disable the connect button when the API key is empty", () => {
    render(<AddKeyModal environmentId={environmentId} open={true} setOpen={setOpen} />);
    const connectButton = screen.getByRole("button", { name: "common.connect" });
    expect(connectButton).toBeDisabled();
  });

  test("should enable the connect button when the API key is not empty", async () => {
    render(<AddKeyModal environmentId={environmentId} open={true} setOpen={setOpen} />);
    const apiKeyInput = screen.getByLabelText("environments.integrations.plain.api_key_label");
    await userEvent.type(apiKeyInput, "test-api-key", { pointerEventsCheck: 0 });
    const connectButton = screen.getByRole("button", { name: "common.connect" });
    expect(connectButton).not.toBeDisabled();
  });

  test("should call the connect action and show a success toast on successful connection", async () => {
    render(<AddKeyModal environmentId={environmentId} open={true} setOpen={setOpen} />);
    const apiKeyInput = screen.getByLabelText("environments.integrations.plain.api_key_label");
    await userEvent.type(apiKeyInput, "test-api-key", { pointerEventsCheck: 0 });
    const connectButton = screen.getByRole("button", { name: "common.connect" });
    await userEvent.click(connectButton);

    await waitFor(() => {
      expect(connectPlainIntegrationAction).toHaveBeenCalledWith({
        environmentId,
        key: "test-api-key",
      });
      expect(toast.success).toHaveBeenCalledWith("environments.integrations.plain.connection_success");
      expect(setOpen).toHaveBeenCalledWith(false);
    });
  });

  test("should show an error toast on a failed connection", async () => {
    (connectPlainIntegrationAction as Mock).mockRejectedValue(new Error("Connection error"));
    render(<AddKeyModal environmentId={environmentId} open={true} setOpen={setOpen} />);
    const apiKeyInput = screen.getByLabelText("environments.integrations.plain.api_key_label");
    await userEvent.type(apiKeyInput, "test-api-key", { pointerEventsCheck: 0 });
    const connectButton = screen.getByRole("button", { name: "common.connect" });
    await userEvent.click(connectButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("environments.integrations.plain.connection_error");
    });
  });
});
