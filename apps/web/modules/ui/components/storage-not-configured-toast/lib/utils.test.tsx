import { render } from "@testing-library/react";
import toast from "react-hot-toast";
import { describe, expect, test, vi } from "vitest";
import { showStorageNotConfiguredToast } from "./utils";

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
  },
}));

// Mock the StorageNotConfiguredToast component
vi.mock("../index", () => ({
  StorageNotConfiguredToast: () => <div data-testid="storage-not-configured-toast">Mocked Toast</div>,
}));

describe("showStorageNotConfiguredToast", () => {
  test("calls toast.error with correct parameters", () => {
    const mockToastError = vi.mocked(toast.error);
    const mockToastId = "test-toast-id";
    mockToastError.mockReturnValue(mockToastId);

    const result = showStorageNotConfiguredToast();

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith(expect.any(Function), {
      id: "storage-not-configured-toast",
    });
    expect(result).toBe(mockToastId);
  });

  test("toast content function renders StorageNotConfiguredToast component", () => {
    const mockToastError = vi.mocked(toast.error);
    let toastContentFunction: () => React.ReactNode;

    mockToastError.mockImplementation((content) => {
      toastContentFunction = content as () => React.ReactNode;
      return "test-toast-id";
    });

    showStorageNotConfiguredToast();

    // Render the content function that was passed to toast.error
    const { getByTestId } = render(toastContentFunction!());
    expect(getByTestId("storage-not-configured-toast")).toBeInTheDocument();
  });

  test("uses correct toast id for deduplication", () => {
    const mockToastError = vi.mocked(toast.error);

    showStorageNotConfiguredToast();

    const callArgs = mockToastError.mock.calls[0];
    const options = callArgs[1];

    expect(options).toEqual({
      id: "storage-not-configured-toast",
    });
  });
});
