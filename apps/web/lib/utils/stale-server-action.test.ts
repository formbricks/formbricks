import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { isStaleServerActionError, registerStaleServerActionListener } from "@/lib/utils/stale-server-action";

const { mockIsUnrecognizedActionError } = vi.hoisted(() => ({
  mockIsUnrecognizedActionError: vi.fn(() => false),
}));

vi.mock("next/navigation", () => ({
  unstable_isUnrecognizedActionError: mockIsUnrecognizedActionError,
}));

const staleActionError = () =>
  Object.assign(new Error('Server Action "7f8e93d" was not found on the server.'), {
    name: "UnrecognizedActionError",
  });

describe("isStaleServerActionError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUnrecognizedActionError.mockReturnValue(false);
  });

  test("accepts what Next.js recognizes as a stale action error", () => {
    const error = new Error("boom");
    mockIsUnrecognizedActionError.mockReturnValue(true);

    expect(isStaleServerActionError(error)).toBe(true);
    expect(mockIsUnrecognizedActionError).toHaveBeenCalledWith(error);
  });

  test("falls back to the error name when the class identity is lost", () => {
    expect(isStaleServerActionError(staleActionError())).toBe(true);
  });

  test("rejects unrelated rejection reasons", () => {
    expect(isStaleServerActionError(new Error("boom"))).toBe(false);
    expect(isStaleServerActionError({ name: "UnrecognizedActionError" })).toBe(false);
    expect(isStaleServerActionError("UnrecognizedActionError")).toBe(false);
    expect(isStaleServerActionError(undefined)).toBe(false);
  });
});

describe("registerStaleServerActionListener", () => {
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();

  const dispatchRejection = (reason: unknown) => {
    const event = { reason, preventDefault: vi.fn() };
    const handler = addEventListener.mock.calls[0][1] as (event: unknown) => void;
    handler(event);
    return event;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUnrecognizedActionError.mockReturnValue(false);
    vi.stubGlobal("window", { addEventListener, removeEventListener } as unknown as Window);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("prompts and marks the rejection handled for a stale action error", () => {
    const onStaleAction = vi.fn();
    registerStaleServerActionListener(onStaleAction);

    const event = dispatchRejection(staleActionError());

    expect(onStaleAction).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  test("leaves every other rejection alone", () => {
    const onStaleAction = vi.fn();
    registerStaleServerActionListener(onStaleAction);

    const event = dispatchRejection(new Error("boom"));

    expect(onStaleAction).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test("removes the listener it registered when unsubscribed", () => {
    const unsubscribe = registerStaleServerActionListener(vi.fn());

    expect(addEventListener).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));

    unsubscribe();

    expect(removeEventListener).toHaveBeenCalledWith("unhandledrejection", addEventListener.mock.calls[0][1]);
  });
});
