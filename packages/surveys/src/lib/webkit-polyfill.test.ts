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

  // Helper function to apply the polyfill logic (same as in index.ts)
  const applyPolyfill = () => {
    const win = window as any;

    const createMessageHandlersProxy = (originalHandlers: any = {}) => {
      return new Proxy(originalHandlers, {
        get(target, prop) {
          const handler = target[prop as keyof typeof target];

          if (!handler) {
            return {
              postMessage: () => {
                console.debug(
                  `WebKit message handler "${String(prop)}" is not available in this environment`
                );
              },
            };
          }

          return handler;
        },
      });
    };

    if (!win.webkit) {
      win.webkit = {
        messageHandlers: createMessageHandlersProxy(),
      };
    } else if (!win.webkit.messageHandlers) {
      win.webkit.messageHandlers = createMessageHandlersProxy();
    } else {
      const originalMessageHandlers = win.webkit.messageHandlers;
      win.webkit.messageHandlers = createMessageHandlersProxy(originalMessageHandlers);
    }
  };

  describe("Scenario 1: window.webkit does not exist (Instagram iOS browser)", () => {
    it("should create window.webkit with proxied messageHandlers", () => {
      // Setup: Remove webkit completely
      delete (window as any).webkit;

      // Apply polyfill
      applyPolyfill();

      // Test: webkit should now exist
      expect((window as any).webkit).toBeDefined();
      expect((window as any).webkit.messageHandlers).toBeDefined();
    });

    it("should not throw when accessing undefined messageHandlers", () => {
      // Setup
      delete (window as any).webkit;

      // Apply polyfill
      applyPolyfill();

      // Test: Accessing an undefined handler should not throw
      expect(() => {
        (window as any).webkit.messageHandlers.undefinedHandler.postMessage("test");
      }).not.toThrow();

      // Verify console.debug was called
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        'WebKit message handler "undefinedHandler" is not available in this environment'
      );
    });

    it("should handle multiple undefined handlers without throwing", () => {
      // Setup
      delete (window as any).webkit;

      // Apply polyfill
      applyPolyfill();

      // Test: Multiple undefined handlers should not throw
      expect(() => {
        (window as any).webkit.messageHandlers.handler1.postMessage("test1");
        (window as any).webkit.messageHandlers.handler2.postMessage("test2");
        (window as any).webkit.messageHandlers.handler3.postMessage("test3");
      }).not.toThrow();

      expect(consoleDebugSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe("Scenario 2: window.webkit exists but messageHandlers does not", () => {
    it("should add proxied messageHandlers to existing webkit", () => {
      // Setup: Create webkit without messageHandlers
      (window as any).webkit = {};

      // Apply polyfill
      applyPolyfill();

      // Test: messageHandlers should now exist
      expect((window as any).webkit.messageHandlers).toBeDefined();
    });

    it("should not throw when accessing undefined handlers", () => {
      // Setup
      (window as any).webkit = {};

      // Apply polyfill
      applyPolyfill();

      // Test
      expect(() => {
        (window as any).webkit.messageHandlers.someHandler.postMessage("test");
      }).not.toThrow();

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        'WebKit message handler "someHandler" is not available in this environment'
      );
    });
  });

  describe("Scenario 3: Both webkit and messageHandlers exist", () => {
    it("should preserve existing handlers while proxying new ones", () => {
      // Setup: Create a webkit object with a real handler
      const mockPostMessage = vi.fn();
      (window as any).webkit = {
        messageHandlers: {
          existingHandler: {
            postMessage: mockPostMessage,
          },
        },
      };

      // Apply polyfill
      applyPolyfill();

      // Test: Existing handler should still work
      (window as any).webkit.messageHandlers.existingHandler.postMessage("test message");
      expect(mockPostMessage).toHaveBeenCalledWith("test message");

      // Test: Undefined handler should not throw
      expect(() => {
        (window as any).webkit.messageHandlers.undefinedHandler.postMessage("test");
      }).not.toThrow();

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        'WebKit message handler "undefinedHandler" is not available in this environment'
      );
    });

    it("should work with multiple existing handlers", () => {
      // Setup
      const mockPostMessage1 = vi.fn();
      const mockPostMessage2 = vi.fn();
      (window as any).webkit = {
        messageHandlers: {
          handler1: {
            postMessage: mockPostMessage1,
          },
          handler2: {
            postMessage: mockPostMessage2,
          },
        },
      };

      // Apply polyfill
      applyPolyfill();

      // Test: All existing handlers should work
      (window as any).webkit.messageHandlers.handler1.postMessage("msg1");
      (window as any).webkit.messageHandlers.handler2.postMessage("msg2");

      expect(mockPostMessage1).toHaveBeenCalledWith("msg1");
      expect(mockPostMessage2).toHaveBeenCalledWith("msg2");

      // Test: Undefined handlers should not throw
      expect(() => {
        (window as any).webkit.messageHandlers.handler3.postMessage("msg3");
      }).not.toThrow();
    });
  });

  describe("Edge cases", () => {
    it("should handle messageHandlers with empty object", () => {
      // Setup
      (window as any).webkit = {
        messageHandlers: {},
      };

      // Apply polyfill
      applyPolyfill();

      // Test
      expect(() => {
        (window as any).webkit.messageHandlers.anyHandler.postMessage("test");
      }).not.toThrow();
    });

    it("should handle messageHandlers with null prototype", () => {
      // Setup
      (window as any).webkit = {
        messageHandlers: Object.create(null),
      };

      // Apply polyfill
      applyPolyfill();

      // Test
      expect(() => {
        (window as any).webkit.messageHandlers.handler.postMessage("test");
      }).not.toThrow();
    });

    it("should not interfere with handler methods other than postMessage", () => {
      // Setup
      const customMethod = vi.fn();
      (window as any).webkit = {
        messageHandlers: {
          customHandler: {
            postMessage: vi.fn(),
            customMethod,
          },
        },
      };

      // Apply polyfill
      applyPolyfill();

      // Test: Custom methods should still be accessible
      (window as any).webkit.messageHandlers.customHandler.customMethod("test");
      expect(customMethod).toHaveBeenCalledWith("test");
    });
  });
});
