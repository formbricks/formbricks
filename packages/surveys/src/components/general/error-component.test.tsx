import { TResponseErrorCodesEnum } from "@/types/response-error-codes";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { ErrorComponent } from "./error-component";

describe("ErrorComponent", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders RecaptchaError correctly", () => {
    render(<ErrorComponent errorType={TResponseErrorCodesEnum.RecaptchaError} />);

    const alertDiv = screen.getByRole("alert");
    expect(alertDiv).toBeInTheDocument();

    const titleSpan = alertDiv.querySelector("span");
    expect(titleSpan?.textContent?.trim()).toBe("errors.recaptcha_error.title");

    const messageP = alertDiv.querySelector("p");
    expect(messageP?.textContent?.trim()).toBe("errors.recaptcha_error.message");
  });

  test("renders InvalidDeviceError correctly", () => {
    render(<ErrorComponent errorType={TResponseErrorCodesEnum.InvalidDeviceError} />);

    const alertDiv = screen.getByRole("alert");
    expect(alertDiv).toBeInTheDocument();

    const titleSpan = alertDiv.querySelector("span");
    expect(titleSpan?.textContent?.trim()).toBe("errors.invalid_device_error.title");

    const messageP = alertDiv.querySelector("p");
    expect(messageP?.textContent?.trim()).toBe("errors.invalid_device_error.message");
  });

  test("has correct accessibility attributes", () => {
    render(<ErrorComponent errorType={TResponseErrorCodesEnum.RecaptchaError} />);

    const alertDiv = screen.getByRole("alert");
    expect(alertDiv).toHaveAttribute("aria-live", "assertive");
  });

  test("has correct styling classes", () => {
    render(<ErrorComponent errorType={TResponseErrorCodesEnum.RecaptchaError} />);

    const alertDiv = screen.getByRole("alert");
    expect(alertDiv).toHaveClass(
      "fb-flex",
      "fb-flex-col",
      "fb-bg-white",
      "fb-p-8",
      "fb-text-center",
      "fb-items-center"
    );

    const titleSpan = screen.getByText("errors.recaptcha_error.title");
    expect(titleSpan).toHaveClass(
      "fb-mb-1.5",
      "fb-text-base",
      "fb-font-bold",
      "fb-leading-6",
      "fb-text-slate-900"
    );

    const messageP = screen.getByText("errors.recaptcha_error.message");
    expect(messageP).toHaveClass(
      "fb-max-w-lg",
      "fb-text-sm",
      "fb-font-normal",
      "fb-leading-6",
      "fb-text-slate-600"
    );
  });
});
