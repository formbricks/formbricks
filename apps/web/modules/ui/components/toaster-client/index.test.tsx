import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ToasterClient } from "./index";

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  Toaster: ({ toastOptions }: any) => (
    <div data-testid="mock-toaster" data-toast-options={JSON.stringify(toastOptions)}>
      Mock Toaster
    </div>
  ),
}));

describe("ToasterClient", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the Toaster component", () => {
    const { getByTestId } = render(<ToasterClient />);

    const toaster = getByTestId("mock-toaster");
    expect(toaster).toBeInTheDocument();
    expect(toaster).toHaveTextContent("Mock Toaster");
  });

  test("passes the correct toast options to the Toaster", () => {
    const { getByTestId } = render(<ToasterClient />);

    const toaster = getByTestId("mock-toaster");
    const toastOptions = JSON.parse(toaster.getAttribute("data-toast-options") || "{}");

    expect(toastOptions).toHaveProperty("success");
    expect(toastOptions).toHaveProperty("error");
    expect(toastOptions.success).toHaveProperty("className", "formbricks__toast__success");
    expect(toastOptions.error).toHaveProperty("className", "formbricks__toast__error");
  });
});
