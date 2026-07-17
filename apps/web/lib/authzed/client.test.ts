import { configMocks, envMock, retryMocks, sdkMocks } from "./__mocks__/client-dependencies";
import { status } from "@grpc/grpc-js";
import { beforeEach, describe, expect, test } from "vitest";
import { closeAuthzedClient, getAuthzedClient } from "./client";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";

describe("AuthZed client facade", () => {
  beforeEach(() => {
    closeAuthzedClient();
    sdkMocks.close.mockReset();
    sdkMocks.deadlineInterceptor.mockClear();
    sdkMocks.newClient.mockReset();
    sdkMocks.readSchema.mockReset();
    configMocks.isAuthzedEnabled.mockReset();
    retryMocks.execute.mockClear();
    envMock.AUTHZED_CONSISTENCY = undefined;
    envMock.AUTHZED_ENDPOINT = "spicedb:50051";
    envMock.AUTHZED_INSECURE = "true";
    envMock.AUTHZED_SYSTEM_KEY = "formbricks";
    envMock.AUTHZED_TOKEN = "private-token";
    sdkMocks.newClient.mockReturnValue({
      close: sdkMocks.close,
      promises: { readSchema: sdkMocks.readSchema },
    });
    configMocks.isAuthzedEnabled.mockReturnValue(true);
  });

  test("does not construct an SDK client until the facade is requested", () => {
    expect(sdkMocks.newClient).not.toHaveBeenCalled();
  });

  test("throws a typed disabled error without constructing the SDK client", () => {
    configMocks.isAuthzedEnabled.mockReturnValue(false);

    expect(() => getAuthzedClient()).toThrow(AuthzedError);
    expect(() => getAuthzedClient()).toThrow(AUTHZED_ERROR_CODES.DISABLED);
    expect(sdkMocks.newClient).not.toHaveBeenCalled();
  });

  test.each([
    [undefined, 0],
    ["false", 0],
    ["0", 0],
    ["true", 2],
    ["1", 2],
  ] as const)("selects the expected SDK security mode for %s", (insecure, expectedSecurity) => {
    envMock.AUTHZED_INSECURE = insecure;

    getAuthzedClient();

    expect(sdkMocks.newClient).toHaveBeenCalledWith(
      envMock.AUTHZED_TOKEN,
      envMock.AUTHZED_ENDPOINT,
      expectedSecurity,
      undefined,
      { interceptors: [{ timeoutMs: 1_000 }] }
    );
    expect(sdkMocks.deadlineInterceptor).toHaveBeenCalledWith(1_000);
  });

  test("uses the consistency default and preserves the configured token only inside the SDK", () => {
    envMock.AUTHZED_TOKEN = " token-with-significant-spacing ";

    const client = getAuthzedClient();

    expect(client.consistency).toBe("minimize_latency");
    expect(client.systemKey).toBe("formbricks");
    expect(sdkMocks.newClient).toHaveBeenCalledWith(
      " token-with-significant-spacing ",
      "spicedb:50051",
      2,
      undefined,
      { interceptors: [{ timeoutMs: 1_000 }] }
    );
    expect(client).not.toHaveProperty("token");
  });

  test("exposes the configured consistency through the Formbricks facade", () => {
    envMock.AUTHZED_CONSISTENCY = "fully_consistent";

    expect(getAuthzedClient().consistency).toBe("fully_consistent");
  });

  test("reuses the facade singleton without retaining public SDK or credential fields", () => {
    const first = getAuthzedClient();
    const second = getAuthzedClient();

    expect(first).toBe(second);
    expect(sdkMocks.newClient).toHaveBeenCalledTimes(1);
    expect(Object.keys(first).sort()).toEqual(["consistency", "readSchema", "systemKey"]);
    expect(first).not.toHaveProperty("token");
    expect(first).not.toHaveProperty("promises");
    expect(first).not.toHaveProperty("close");
  });

  test("closes, resets, and reconstructs the internal client", () => {
    const first = getAuthzedClient();

    closeAuthzedClient();
    const second = getAuthzedClient();

    expect(sdkMocks.close).toHaveBeenCalledTimes(1);
    expect(sdkMocks.newClient).toHaveBeenCalledTimes(2);
    expect(second).not.toBe(first);
  });

  test("returns only the Formbricks schema wrapper through the resilience pipeline", async () => {
    sdkMocks.readSchema.mockResolvedValue({
      readAt: { token: "revision" },
      schemaText: "definition user {}",
    });

    await expect(getAuthzedClient().readSchema()).resolves.toEqual({
      schemaText: "definition user {}",
    });
    expect(sdkMocks.readSchema).toHaveBeenCalledWith({});
    expect(retryMocks.execute).toHaveBeenCalledWith("read_schema", expect.any(Function));
  });

  test("normalizes SpiceDB's uninitialized-schema response to an empty successful schema", async () => {
    sdkMocks.readSchema.mockRejectedValue({ code: status.NOT_FOUND });

    await expect(getAuthzedClient().readSchema()).resolves.toEqual({ schemaText: "" });
    expect(retryMocks.execute).toHaveBeenCalledWith("read_schema", expect.any(Function));
  });
});
