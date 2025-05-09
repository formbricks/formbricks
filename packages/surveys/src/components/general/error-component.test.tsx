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
    expect(titleSpan?.textContent?.trim()).toBe("We couldn't verify that you're human.");

    const messageP = alertDiv.querySelector("p");
    expect(messageP?.textContent?.trim()).toBe(
      "Your response could not be submitted because it was flagged as automated activity. If you breathe, please try again."
    );
  });

  test("renders InvalidDeviceError correctly", () => {
    render(<ErrorComponent errorType={TResponseErrorCodesEnum.InvalidDeviceError} />);

    const alertDiv = screen.getByRole("alert");
    expect(alertDiv).toBeInTheDocument();

    const titleSpan = alertDiv.querySelector("span");
    expect(titleSpan?.textContent?.trim()).toBe("This device doesn’t support spam protection.");

    const messageP = alertDiv.querySelector("p");
    expect(messageP?.textContent?.trim()).toBe(
      "Please disable spam protection in the survey settings to continue using this device."
    );
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

    const titleSpan = screen.getByText(/We couldn't verify that you're human/);
    expect(titleSpan).toHaveClass(
      "fb-mb-1.5",
      "fb-text-base",
      "fb-font-bold",
      "fb-leading-6",
      "fb-text-slate-900"
    );

    const messageP = screen.getByText(/Your response could not be submitted/);
    expect(messageP).toHaveClass(
      "fb-max-w-lg",
      "fb-text-sm",
      "fb-font-normal",
      "fb-leading-6",
      "fb-text-slate-600"
    );
  });
});
