// config.test.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mockConfig } from "./__mocks__/config.mock";
import { RNConfig, RN_ASYNC_STORAGE_KEY } from "@/lib/common/config";
import type { TConfig, TConfigUpdateInput } from "@/types/config";

// Define mocks outside of any describe block

describe("RNConfig", () => {
  let configInstance: RNConfig;

  beforeEach(async () => {
    // Clear mocks between tests
    vi.clearAllMocks();

    // get the config instance
    configInstance = RNConfig.getInstance();

    // reset the config
    await configInstance.resetConfig();

    // get the config instance again
    configInstance = RNConfig.getInstance();
  });

  afterEach(() => {
    // In case we want to restore them after all tests
    vi.restoreAllMocks();
  });

  test("getInstance() returns a singleton", () => {
    const secondInstance = RNConfig.getInstance();
    expect(configInstance).toBe(secondInstance);
  });

  test("get() throws if config is null", () => {
    // constructor didn't load anything successfully
    // so config is still null
    expect(() => configInstance.get()).toThrow("config is null, maybe the init function was not called?");
  });

  test("loadFromStorage() returns ok if valid config is found", async () => {
    vi.spyOn(AsyncStorage, "getItem").mockResolvedValueOnce(JSON.stringify(mockConfig));

    const result = await configInstance.loadFromStorage();
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.data).toEqual(mockConfig);
    }
  });

  test("loadFromStorage() returns err if config is expired", async () => {
    const expiredConfig = {
      ...mockConfig,
      environment: {
        ...mockConfig.environment,
        expiresAt: new Date("2000-01-01T00:00:00Z"),
      },
    };

    vi.spyOn(AsyncStorage, "getItem").mockResolvedValueOnce(JSON.stringify(expiredConfig));

    const result = await configInstance.loadFromStorage();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Config in local storage has expired");
    }
  });

  test("loadFromStorage() returns err if no or invalid config in storage", async () => {
    // Simulate no data
    vi.spyOn(AsyncStorage, "getItem").mockResolvedValueOnce(null);

    const result = await configInstance.loadFromStorage();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("No or invalid config in local storage");
    }
  });

  test("update() merges new config, calls saveToStorage()", async () => {
    vi.spyOn(AsyncStorage, "getItem").mockResolvedValueOnce(JSON.stringify(mockConfig));

    // Wait for the constructor's async load
    await new Promise(setImmediate);

    // Now we call update()
    const newStatus = { value: "error", expiresAt: "2100-01-01T00:00:00Z" } as unknown as TConfig["status"];

    configInstance.update({ ...mockConfig, status: newStatus } as unknown as TConfigUpdateInput);

    // The update call should eventually call setItem on AsyncStorage
    expect(AsyncStorage.setItem).toHaveBeenCalled();
    // Let’s check if we can read the updated config:
    const updatedConfig = configInstance.get();
    expect(updatedConfig.status.value).toBe("error");
    expect(updatedConfig.status.expiresAt).toBe("2100-01-01T00:00:00Z");
  });

  test("saveToStorage() is invoked internally on update()", async () => {
    vi.spyOn(AsyncStorage, "getItem").mockResolvedValueOnce(JSON.stringify(mockConfig));

    await new Promise(setImmediate);

    configInstance.update({ status: { value: "success", expiresAt: null } } as unknown as TConfigUpdateInput);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      RN_ASYNC_STORAGE_KEY,
      expect.any(String) // the JSON string
    );
  });

  test("resetConfig() clears config and AsyncStorage", async () => {
    vi.spyOn(AsyncStorage, "getItem").mockResolvedValueOnce(JSON.stringify(mockConfig));
    await new Promise(setImmediate);

    // Now reset
    const result = await configInstance.resetConfig();

    expect(result.ok).toBe(true);
    // config is now null
    expect(() => configInstance.get()).toThrow("config is null");
    // removeItem should be called
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(RN_ASYNC_STORAGE_KEY);
  });
});
