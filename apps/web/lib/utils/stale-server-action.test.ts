import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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

// The module latches once a stale action has been reported, so every test gets its own copy.
const loadModule = async () => {
  vi.resetModules();
  return import("@/lib/utils/stale-server-action");
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsUnrecognizedActionError.mockReturnValue(false);
});

describe("isStaleServerActionError", () => {
  test("accepts what Next.js recognizes as a stale action error", async () => {
    const { isStaleServerActionError } = await loadModule();
    const error = new Error("boom");
    mockIsUnrecognizedActionError.mockReturnValue(true);

    expect(isStaleServerActionError(error)).toBe(true);
    expect(mockIsUnrecognizedActionError).toHaveBeenCalledWith(error);
  });

  test("falls back to the error name when the class identity is lost", async () => {
    const { isStaleServerActionError } = await loadModule();

    expect(isStaleServerActionError(staleActionError())).toBe(true);
  });

  test("rejects unrelated rejection reasons", async () => {
    const { isStaleServerActionError } = await loadModule();

    expect(isStaleServerActionError(new Error("boom"))).toBe(false);
    expect(isStaleServerActionError({ name: "UnrecognizedActionError" })).toBe(false);
    expect(isStaleServerActionError("UnrecognizedActionError")).toBe(false);
    expect(isStaleServerActionError(undefined)).toBe(false);
  });
});

describe("reportStaleServerActionError", () => {
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("window", { addEventListener, removeEventListener } as unknown as Window);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * The editor's save, autosave, publish and schedule paths all `await` their action inside a
   * `try/catch`, so their rejection is consumed before `unhandledrejection` would ever see it --
   * this is the shape that has to reach the prompt through the reported path instead.
   */
  const callStaleAction = async () => {
    const updateSurveyAction = () => Promise.reject(staleActionError());

    try {
      await updateSurveyAction();
      return undefined;
    } catch (error) {
      return error;
    }
  };

  test("prompts for an action rejection a caller already caught", async () => {
    const { registerStaleServerActionListener, reportStaleServerActionError } = await loadModule();
    const onStaleAction = vi.fn();
    registerStaleServerActionListener(onStaleAction);

    const caught = await callStaleAction();

    expect(onStaleAction).not.toHaveBeenCalled();
    expect(reportStaleServerActionError(caught)).toBe(true);
    expect(onStaleAction).toHaveBeenCalledTimes(1);
  });

  test("leaves a caller's own error handling to it for every other rejection", async () => {
    const { registerStaleServerActionListener, reportStaleServerActionError } = await loadModule();
    const onStaleAction = vi.fn();
    registerStaleServerActionListener(onStaleAction);

    expect(reportStaleServerActionError(new Error("boom"))).toBe(false);
    expect(onStaleAction).not.toHaveBeenCalled();
  });

  test("prompts a subscriber that arrives after the report", async () => {
    const { registerStaleServerActionListener, reportStaleServerActionError } = await loadModule();

    reportStaleServerActionError(staleActionError());

    const onStaleAction = vi.fn();
    registerStaleServerActionListener(onStaleAction);

    expect(onStaleAction).toHaveBeenCalledTimes(1);
  });

  test("stops prompting a subscriber that unsubscribed", async () => {
    const { registerStaleServerActionListener, reportStaleServerActionError } = await loadModule();
    const onStaleAction = vi.fn();

    registerStaleServerActionListener(onStaleAction)();
    reportStaleServerActionError(staleActionError());

    expect(onStaleAction).not.toHaveBeenCalled();
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
    vi.stubGlobal("window", { addEventListener, removeEventListener } as unknown as Window);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("prompts and marks the rejection handled for a stale action error", async () => {
    const { registerStaleServerActionListener } = await loadModule();
    const onStaleAction = vi.fn();
    registerStaleServerActionListener(onStaleAction);

    const event = dispatchRejection(staleActionError());

    expect(onStaleAction).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  test("leaves every other rejection alone", async () => {
    const { registerStaleServerActionListener } = await loadModule();
    const onStaleAction = vi.fn();
    registerStaleServerActionListener(onStaleAction);

    const event = dispatchRejection(new Error("boom"));

    expect(onStaleAction).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test("removes the listener it registered when unsubscribed", async () => {
    const { registerStaleServerActionListener } = await loadModule();
    const unsubscribe = registerStaleServerActionListener(vi.fn());

    expect(addEventListener).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));

    unsubscribe();

    expect(removeEventListener).toHaveBeenCalledWith("unhandledrejection", addEventListener.mock.calls[0][1]);
  });
});
