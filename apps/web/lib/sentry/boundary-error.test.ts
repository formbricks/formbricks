import { beforeEach, describe, expect, test, vi } from "vitest";
import { reportBoundaryError } from "@/lib/sentry/boundary-error";

const { mockCaptureException, build } = vi.hoisted(() => ({
  mockCaptureException: vi.fn(),
  build: { isDevelopment: false },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

vi.mock("@/lib/env-client", () => ({
  get IS_DEVELOPMENT_BUILD() {
    return build.isDevelopment;
  },
}));

const errorWith = (props: { name?: string; digest?: string }): Error & { digest?: string } =>
  Object.assign(new Error("boom"), props);

describe("reportBoundaryError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    build.isDevelopment = false;
  });

  test("reports an error thrown in the browser", () => {
    const error = errorWith({});

    reportBoundaryError(error);

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });

  test("skips a server error, which onRequestError already handled", () => {
    reportBoundaryError(errorWith({ digest: "3464868072" }));

    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  test("skips an expected error", () => {
    reportBoundaryError(errorWith({ name: "ResourceNotFoundError" }));

    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  test("logs instead of reporting in a development build", () => {
    build.isDevelopment = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportBoundaryError(errorWith({}));

    expect(consoleError).toHaveBeenCalledWith("boom");
    expect(mockCaptureException).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
