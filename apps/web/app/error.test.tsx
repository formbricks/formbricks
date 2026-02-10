import * as Sentry from "@sentry/nextjs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  AuthenticationError,
  AuthorizationError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
  ValidationError,
} from "@formbricks/types/errors";
import ErrorBoundary from "./error";

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock UI components so we can inspect rendered content without pulling in the full tree
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({
    children,
    onClick,
    variant,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    className?: string;
  }) => (
    <button data-variant={variant} className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/error-component", () => ({
  ErrorComponent: ({ title, description }: { title: string; description: string }) => (
    <div>
      <h1 data-testid="error-title">{title}</h1>
      <p data-testid="error-description">{description}</p>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockReset = vi.fn();

describe("ErrorBoundary", () => {
  describe("Sentry reporting (production behaviour)", () => {
    // In vitest NODE_ENV is "test", so the component takes the else-if branch (production path).
    // Sentry calls happen inside useEffect, so we use waitFor to assert after the effect runs.

    test("does NOT report AuthorizationError to Sentry", async () => {
      render(<ErrorBoundary error={new AuthorizationError("Forbidden")} reset={mockReset} />);
      await waitFor(() => expect(Sentry.captureException).not.toHaveBeenCalled());
    });

    test("does NOT report AuthenticationError to Sentry", async () => {
      render(<ErrorBoundary error={new AuthenticationError("Not logged in")} reset={mockReset} />);
      await waitFor(() => expect(Sentry.captureException).not.toHaveBeenCalled());
    });

    test("does NOT report TooManyRequestsError to Sentry", async () => {
      render(<ErrorBoundary error={new TooManyRequestsError("Slow down")} reset={mockReset} />);
      await waitFor(() => expect(Sentry.captureException).not.toHaveBeenCalled());
    });

    test("does NOT report ResourceNotFoundError to Sentry", async () => {
      render(<ErrorBoundary error={new ResourceNotFoundError("Survey", "abc")} reset={mockReset} />);
      await waitFor(() => expect(Sentry.captureException).not.toHaveBeenCalled());
    });

    test("does NOT report InvalidInputError to Sentry", async () => {
      render(<ErrorBoundary error={new InvalidInputError("Bad input")} reset={mockReset} />);
      await waitFor(() => expect(Sentry.captureException).not.toHaveBeenCalled());
    });

    test("does NOT report ValidationError to Sentry", async () => {
      render(<ErrorBoundary error={new ValidationError("Invalid data")} reset={mockReset} />);
      await waitFor(() => expect(Sentry.captureException).not.toHaveBeenCalled());
    });

    test("does NOT report OperationNotAllowedError to Sentry", async () => {
      render(<ErrorBoundary error={new OperationNotAllowedError("Nope")} reset={mockReset} />);
      await waitFor(() => expect(Sentry.captureException).not.toHaveBeenCalled());
    });

    test("DOES report a generic Error to Sentry", async () => {
      const error = new Error("Something broke");
      render(<ErrorBoundary error={error} reset={mockReset} />);
      await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledWith(error));
    });

    test("DOES report a TypeError to Sentry", async () => {
      const error = new TypeError("Cannot read properties");
      render(<ErrorBoundary error={error} reset={mockReset} />);
      await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledWith(error));
    });
  });

  describe("useEffect deduplication", () => {
    test("reports the same error only once across re-renders", async () => {
      const error = new Error("Crash");
      const { rerender } = render(<ErrorBoundary error={error} reset={mockReset} />);
      await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledTimes(1));

      // Re-render with the same error reference — useEffect should not fire again
      rerender(<ErrorBoundary error={error} reset={mockReset} />);
      await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledTimes(1));
    });

    test("reports again when a different error is provided", async () => {
      const error1 = new Error("First");
      const error2 = new Error("Second");
      const { rerender } = render(<ErrorBoundary error={error1} reset={mockReset} />);
      await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledTimes(1));

      rerender(<ErrorBoundary error={error2} reset={mockReset} />);
      await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledTimes(2));
    });
  });

  describe("error message selection", () => {
    test("shows rate-limit messages for TooManyRequestsError", () => {
      render(<ErrorBoundary error={new TooManyRequestsError("Slow down")} reset={mockReset} />);

      expect(screen.getByTestId("error-title")).toHaveTextContent("common.error_rate_limit_title");
      expect(screen.getByTestId("error-description")).toHaveTextContent(
        "common.error_rate_limit_description"
      );
    });

    test("shows general error messages for non-rate-limit errors", () => {
      render(<ErrorBoundary error={new Error("Something broke")} reset={mockReset} />);

      expect(screen.getByTestId("error-title")).toHaveTextContent("common.error_component_title");
      expect(screen.getByTestId("error-description")).toHaveTextContent("common.error_component_description");
    });
  });

  describe("action buttons visibility", () => {
    test("shows Try Again and Go to Dashboard buttons for general errors", () => {
      render(<ErrorBoundary error={new Error("Something broke")} reset={mockReset} />);

      expect(screen.getByText("common.try_again")).toBeInTheDocument();
      expect(screen.getByText("common.go_to_dashboard")).toBeInTheDocument();
    });

    test("hides action buttons for TooManyRequestsError", () => {
      render(<ErrorBoundary error={new TooManyRequestsError("Rate limited")} reset={mockReset} />);

      expect(screen.queryByText("common.try_again")).not.toBeInTheDocument();
      expect(screen.queryByText("common.go_to_dashboard")).not.toBeInTheDocument();
    });
  });

  describe("reset behaviour", () => {
    test("calls reset when Try Again button is clicked", async () => {
      render(<ErrorBoundary error={new Error("Oops")} reset={mockReset} />);

      await userEvent.click(screen.getByText("common.try_again"));
      expect(mockReset).toHaveBeenCalledOnce();
    });
  });
});
