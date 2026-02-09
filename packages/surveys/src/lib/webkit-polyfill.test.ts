import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("WebKit messageHandlers polyfill", () => {
  let originalWebkit: any;
  let consoleDebugSpy: any;

  beforeEach(() => {
    // Save the original webkit object if it exists
    originalWebkit = (window as any).webkit;
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore the original webkit object
    if (originalWebkit) {
      (window as any).webkit = originalWebkit;
    } else {
      delete (window as any).webkit;
    }
    consoleDebugSpy.mockRestore();
  });

  it("should not throw when accessing undefined messageHandlers", () => {
    // Setup: Create a webkit object with messageHandlers but no specific handlers
    (window as any).webkit = {
      messageHandlers: {},
    };

    // Apply the polyfill logic
    const originalMessageHandlers = (window as any).webkit.messageHandlers;
    (window as any).webkit.messageHandlers = new Proxy(originalMessageHandlers, {
      get(target, prop) {
        const handler = target[prop as keyof typeof target];

        if (!handler) {
          return {
            postMessage: () => {
              console.debug(`WebKit message handler "${String(prop)}" is not available in this environment`);
            },
          };
        }

        return handler;
      },
    });

    // Test: Accessing an undefined handler should not throw
    expect(() => {
      (window as any).webkit.messageHandlers.undefinedHandler.postMessage("test");
    }).not.toThrow();

    // Verify console.debug was called
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      'WebKit message handler "undefinedHandler" is not available in this environment'
    );
  });

  it("should still work with existing handlers", () => {
    // Setup: Create a webkit object with a real handler
    const mockPostMessage = vi.fn();
    (window as any).webkit = {
      messageHandlers: {
        existingHandler: {
          postMessage: mockPostMessage,
        },
      },
    };

    // Apply the polyfill logic
    const originalMessageHandlers = (window as any).webkit.messageHandlers;
    (window as any).webkit.messageHandlers = new Proxy(originalMessageHandlers, {
      get(target, prop) {
        const handler = target[prop as keyof typeof target];

        if (!handler) {
          return {
            postMessage: () => {
              console.debug(`WebKit message handler "${String(prop)}" is not available in this environment`);
            },
          };
        }

        return handler;
      },
    });

    // Test: Existing handler should still work
    (window as any).webkit.messageHandlers.existingHandler.postMessage("test message");

    expect(mockPostMessage).toHaveBeenCalledWith("test message");
  });

  it("should handle multiple undefined handlers", () => {
    // Setup
    (window as any).webkit = {
      messageHandlers: {},
    };

    // Apply the polyfill logic
    const originalMessageHandlers = (window as any).webkit.messageHandlers;
    (window as any).webkit.messageHandlers = new Proxy(originalMessageHandlers, {
      get(target, prop) {
        const handler = target[prop as keyof typeof target];

        if (!handler) {
          return {
            postMessage: () => {
              console.debug(`WebKit message handler "${String(prop)}" is not available in this environment`);
            },
          };
        }

        return handler;
      },
    });

    // Test: Multiple undefined handlers should not throw
    expect(() => {
      (window as any).webkit.messageHandlers.handler1.postMessage("test1");
      (window as any).webkit.messageHandlers.handler2.postMessage("test2");
      (window as any).webkit.messageHandlers.handler3.postMessage("test3");
    }).not.toThrow();

    expect(consoleDebugSpy).toHaveBeenCalledTimes(3);
  });
});
