/* eslint-disable @typescript-eslint/unbound-method -- required for mocking */
// config.test.ts
import { type Mock, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Config } from "@/lib/common/config";
import { JS_LOCAL_STORAGE_KEY } from "@/lib/common/constants";
import type { TConfig, TConfigUpdateInput } from "@/types/config";
import { mockConfig } from "./__mocks__/config.mock";

// Define mocks outside of any describe block
const getItemMock = localStorage.getItem as unknown as Mock;
const setItemMock = localStorage.setItem as unknown as Mock;
const removeItemMock = localStorage.removeItem as unknown as Mock;

describe("Config", () => {
  let configInstance: Config;

  beforeEach(() => {
    // Clear mocks between tests
    vi.clearAllMocks();

    // get the config instance
    configInstance = Config.getInstance();

    // reset the config
    configInstance.resetConfig();

    // get the config instance again
    configInstance = Config.getInstance();
  });

  afterEach(() => {
    // In case we want to restore them after all tests
    vi.restoreAllMocks();
  });

  test("getInstance() returns a singleton", () => {
    const secondInstance = Config.getInstance();
    expect(configInstance).toBe(secondInstance);
  });

  test("get() throws if config is null", () => {
    // constructor didn't load anything successfully
    // so config is still null
    expect(() => configInstance.get()).toThrow("config is null, maybe the init function was not called?");
  });

  test("loadFromStorage() returns ok if valid config is found", () => {
    getItemMock.mockReturnValueOnce(JSON.stringify(mockConfig));

    const result = configInstance.loadFromLocalStorage();
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data).toEqual(mockConfig);
    }

    expect(getItemMock).toHaveBeenCalledWith(JS_LOCAL_STORAGE_KEY);
  });

  test("loadFromStorage() returns err if config is not saved", () => {
    getItemMock.mockReturnValueOnce(null);

    const result = configInstance.loadFromLocalStorage();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("No or invalid config in local storage");
    }

    expect(getItemMock).toHaveBeenCalledWith(JS_LOCAL_STORAGE_KEY);
  });

  test("loadFromStorage() returns err if no or invalid config in storage", () => {
    // Simulate no data
    getItemMock.mockReturnValueOnce(null);

    const result = configInstance.loadFromLocalStorage();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("No or invalid config in local storage");
    }

    expect(getItemMock).toHaveBeenCalledWith(JS_LOCAL_STORAGE_KEY);
  });

  test("update() merges new config, calls saveToStorage()", async () => {
    getItemMock.mockReturnValueOnce(JSON.stringify(mockConfig));

    // Wait for the constructor's async load
    await new Promise(setImmediate);

    // Now we call update()
    const newStatus = { value: "error", expiresAt: "2100-01-01T00:00:00Z" } as unknown as TConfig["status"];

    configInstance.update({ ...mockConfig, status: newStatus } as unknown as TConfigUpdateInput);

    // The update call should eventually call setItem on AsyncStorage
    expect(setItemMock).toHaveBeenCalledWith(JS_LOCAL_STORAGE_KEY, expect.any(String));
    // Let’s check if we can read the updated config:
    const updatedConfig = configInstance.get();
    expect(updatedConfig.status.value).toBe("error");
    expect(updatedConfig.status.expiresAt).toBe("2100-01-01T00:00:00Z");
  });

  test("saveToStorage() is invoked internally on update()", async () => {
    getItemMock.mockReturnValueOnce(JSON.stringify(mockConfig));

    await new Promise(setImmediate);

    configInstance.update({ status: { value: "success", expiresAt: null } } as unknown as TConfigUpdateInput);
    expect(setItemMock).toHaveBeenCalledWith(JS_LOCAL_STORAGE_KEY, expect.any(String));
  });

  test("resetConfig() clears config and AsyncStorage", () => {
    getItemMock.mockReturnValueOnce(JSON.stringify(mockConfig));

    // Now reset
    const result = configInstance.resetConfig();

    expect(result.ok).toBe(true);
    // config is now null
    expect(() => configInstance.get()).toThrow("config is null");
    // removeItem should be called
    expect(removeItemMock).toHaveBeenCalledWith(JS_LOCAL_STORAGE_KEY);
  });
});
