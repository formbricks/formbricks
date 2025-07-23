// event-listeners.test.ts
import { type Mock, beforeEach, describe, expect, test, vi } from "vitest";
import {
  addCleanupEventListeners,
  addEventListeners,
  removeAllEventListeners,
  removeCleanupEventListeners,
} from "@/lib/common/event-listeners";
import * as environmentState from "@/lib/environment/state";
import * as pageUrlEventListeners from "@/lib/survey/no-code-action";
import * as userState from "@/lib/user/state";

// 1) Mock all the imported dependencies

vi.mock("@/lib/environment/state", () => ({
  addEnvironmentStateExpiryCheckListener: vi.fn(),
  clearEnvironmentStateExpiryCheckListener: vi.fn(),
}));

vi.mock("@/lib/user/state", () => ({
  addUserStateExpiryCheckListener: vi.fn(),
  clearUserStateExpiryCheckListener: vi.fn(),
}));

vi.mock("@/lib/survey/no-code-action", () => ({
  addPageUrlEventListeners: vi.fn(),
  removePageUrlEventListeners: vi.fn(),
  addClickEventListener: vi.fn(),
  removeClickEventListener: vi.fn(),
  addExitIntentListener: vi.fn(),
  removeExitIntentListener: vi.fn(),
  addScrollDepthListener: vi.fn(),
  removeScrollDepthListener: vi.fn(),
}));

// We'll need to track if "areRemoveEventListenersAdded" was set
// but it's a private variable. We'll rely on your public function's side effects
// or test the outcome.

describe("event-listeners file", () => {
  // We'll spy on `window.addEventListener` and `window.removeEventListener` for the cleanup logic

  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // addEventListeners
  // ---------------------------------------------------------------------------
  test("addEventListeners calls each imported add* function", () => {
    // Ensure the mocks are set up before calling the functions
    const mockEnvAdd = vi.spyOn(environmentState, "addEnvironmentStateExpiryCheckListener");
    const mockUserAdd = vi.spyOn(userState, "addUserStateExpiryCheckListener");
    const mockPageUrlAdd = vi.spyOn(pageUrlEventListeners, "addPageUrlEventListeners");
    const mockClickAdd = vi.spyOn(pageUrlEventListeners, "addClickEventListener");
    const mockExitAdd = vi.spyOn(pageUrlEventListeners, "addExitIntentListener");
    const mockScrollAdd = vi.spyOn(pageUrlEventListeners, "addScrollDepthListener");

    // Call the function after setting up the spies
    addEventListeners();

    // Assertions
    expect(mockEnvAdd).toHaveBeenCalled();
    expect(mockUserAdd).toHaveBeenCalled();
    expect(mockPageUrlAdd).toHaveBeenCalled();
    expect(mockClickAdd).toHaveBeenCalled();
    expect(mockExitAdd).toHaveBeenCalled();
    expect(mockScrollAdd).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // addCleanupEventListeners
  // ---------------------------------------------------------------------------
  test("addCleanupEventListeners adds a 'beforeunload' listener if not already added", () => {
    // By default, we haven't added cleanup events yet
    addCleanupEventListeners();
    expect(window.addEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  test("addCleanupEventListeners does nothing if already added once", () => {
    // Call it once
    addCleanupEventListeners();
    (window.addEventListener as unknown as Mock).mockClear();

    // Call again => should skip
    addCleanupEventListeners();
    expect(window.addEventListener).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // removeCleanupEventListeners
  // ---------------------------------------------------------------------------
  test("removeCleanupEventListeners removes the 'beforeunload' listener if it was added", () => {
    addCleanupEventListeners(); // sets areRemoveEventListenersAdded = true
    removeCleanupEventListeners();

    expect(window.removeEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  test("removeCleanupEventListeners does nothing if not added", () => {
    // We never called addCleanupEventListeners, so it's not added
    (window.removeEventListener as unknown as Mock).mockClear();

    removeCleanupEventListeners();
    expect(window.removeEventListener).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // removeAllEventListeners
  // ---------------------------------------------------------------------------
  test("removeAllEventListeners calls all the remove/clear functions", () => {
    // Ensure the mocks are set up before calling the function
    const mockEnvClear = vi.spyOn(environmentState, "clearEnvironmentStateExpiryCheckListener");
    const mockUserClear = vi.spyOn(userState, "clearUserStateExpiryCheckListener");
    const mockPageUrlRemove = vi.spyOn(pageUrlEventListeners, "removePageUrlEventListeners");
    const mockClickRemove = vi.spyOn(pageUrlEventListeners, "removeClickEventListener");
    const mockExitRemove = vi.spyOn(pageUrlEventListeners, "removeExitIntentListener");
    const mockScrollRemove = vi.spyOn(pageUrlEventListeners, "removeScrollDepthListener");

    // Call the function after setting up the spies
    removeAllEventListeners();

    // Assertions
    expect(mockEnvClear).toHaveBeenCalled();
    expect(mockUserClear).toHaveBeenCalled();
    expect(mockPageUrlRemove).toHaveBeenCalled();
    expect(mockClickRemove).toHaveBeenCalled();
    expect(mockExitRemove).toHaveBeenCalled();
    expect(mockScrollRemove).toHaveBeenCalled();
  });

  test("removeAllEventListeners also calls removeCleanupEventListeners", () => {
    // We'll spy on removeCleanupEventListeners if we want
    // or just confirm it removes the event
    addCleanupEventListeners();
    removeAllEventListeners();

    expect(window.removeEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });
});
