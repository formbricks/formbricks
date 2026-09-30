import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockIsUnrecognizedActionError } = vi.hoisted(() => ({
  mockIsUnrecognizedActionError: vi.fn(() => false),
}));

vi.mock("next/navigation", () => ({
  unstable_isUnrecognizedActionError: mockIsUnrecognizedActionError,
}));

/** Both markers Next.js stamps on the rejection, so this matches what a real stale action produces. */
const staleActionError = () =>
  Object.assign(new Error('Server Action "7f8e93d" was not found on the server.'), {
    name: "UnrecognizedActionError",
    __NEXT_ERROR_CODE: "E715",
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

  test("falls back to the framework's own markers when the class identity is lost", async () => {
    const { isStaleServerActionError } = await loadModule();

    expect(isStaleServerActionError(staleActionError())).toBe(true);
  });

  test("rejects an application error that only borrows the name", async () => {
    const { isStaleServerActionError } = await loadModule();
    const impostor = Object.assign(new Error("boom"), { name: "UnrecognizedActionError" });

    // Accepting this would raise the reload prompt over a working page and drop a real error from
    // Sentry, so the name on its own is never enough.
    expect(isStaleServerActionError(impostor)).toBe(false);
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

/**
 * The path that covers every call site which never delegates. `createOrganizationAction` and
 * `updateMembershipAction` are two of 72 components that `catch` around an action and show their own
 * generic message; none of them reach `unhandledrejection`, so the response header is the only signal
 * left that the prompt can be raised from.
 */
describe("the stale action response observer", () => {
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();

  const respondWith = (headers: Record<string, string>) =>
    vi.fn(() => Promise.resolve({ headers: new Headers(headers) } as Response));

  beforeEach(() => {
    vi.stubGlobal("window", { addEventListener, removeEventListener, fetch: vi.fn() } as unknown as Window);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("prompts for a stale action whose rejection the caller swallows", async () => {
    const { registerStaleServerActionListener } = await loadModule();
    window.fetch = respondWith({ "x-nextjs-action-not-found": "1" });
    const onStaleAction = vi.fn();
    registerStaleServerActionListener(onStaleAction);

    // The caller shows its own message and never rethrows -- the shape this observer exists for.
    try {
      await window.fetch("/create-organization");
    } catch {
      /* swallowed, as the call sites do */
    }

    expect(onStaleAction).toHaveBeenCalledTimes(1);
  });

  test("leaves an ordinary response alone", async () => {
    const { registerStaleServerActionListener } = await loadModule();
    window.fetch = respondWith({ "content-type": "text/x-component" });
    const onStaleAction = vi.fn();
    registerStaleServerActionListener(onStaleAction);

    await window.fetch("/some-action");

    expect(onStaleAction).not.toHaveBeenCalled();
  });

  test("hands the response back untouched", async () => {
    const { registerStaleServerActionListener } = await loadModule();
    const response = { headers: new Headers({ "x-nextjs-action-not-found": "1" }) } as Response;
    window.fetch = vi.fn(() => Promise.resolve(response));
    registerStaleServerActionListener(vi.fn());

    // Reading headers must not consume the body or swap the response a caller is awaiting.
    await expect(window.fetch("/create-organization")).resolves.toBe(response);
  });

  test("restores the original fetch once the last subscriber leaves", async () => {
    const { registerStaleServerActionListener } = await loadModule();
    const originalFetch = respondWith({});
    window.fetch = originalFetch;

    const unsubscribeFirst = registerStaleServerActionListener(vi.fn());
    const unsubscribeSecond = registerStaleServerActionListener(vi.fn());
    expect(window.fetch).not.toBe(originalFetch);

    unsubscribeFirst();
    // Still wrapped: the second subscriber is relying on it.
    expect(window.fetch).not.toBe(originalFetch);

    unsubscribeSecond();
    expect(window.fetch).toBe(originalFetch);
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
