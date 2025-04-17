import Intercom from "@intercom/messenger-js-sdk";
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TUser } from "@formbricks/types/user";
import { IntercomClient } from "./IntercomClient";

vi.mock("@intercom/messenger-js-sdk", () => ({
  default: vi.fn(),
}));

describe("IntercomClient", () => {
  let originalWindowIntercom: any;
  let mockWindowIntercom = vi.fn();

  beforeEach(() => {
    // Save original window.Intercom so we can restore it later
    originalWindowIntercom = global.window?.Intercom;
    // Mock window.Intercom so we can verify the shutdown call on unmount
    global.window.Intercom = mockWindowIntercom;
  });

  afterEach(() => {
    cleanup();
    // Restore the original window.Intercom
    global.window.Intercom = originalWindowIntercom;
  });

  test("calls Intercom with user data when isIntercomConfigured is true and user is provided", () => {
    const testUser = {
      id: "test-id",
      name: "Test User",
      email: "test@example.com",
      createdAt: new Date("2020-01-01T00:00:00Z"),
    } as TUser;

    render(
      <IntercomClient
        isIntercomConfigured={true}
        intercomUserHash="my-user-hash"
        intercomAppId="my-app-id"
        user={testUser}
      />
    );

    // Verify Intercom was called with the expected params
    expect(Intercom).toHaveBeenCalledTimes(1);
    expect(Intercom).toHaveBeenCalledWith({
      app_id: "my-app-id",
      user_id: "test-id",
      user_hash: "my-user-hash",
      name: "Test User",
      email: "test@example.com",
      created_at: 1577836800, // Epoch for 2020-01-01T00:00:00Z
    });
  });

  test("calls Intercom with user data without createdAt", () => {
    const testUser = {
      id: "test-id",
      name: "Test User",
      email: "test@example.com",
    } as TUser;

    render(
      <IntercomClient
        isIntercomConfigured={true}
        intercomUserHash="my-user-hash"
        intercomAppId="my-app-id"
        user={testUser}
      />
    );

    // Verify Intercom was called with the expected params
    expect(Intercom).toHaveBeenCalledTimes(1);
    expect(Intercom).toHaveBeenCalledWith({
      app_id: "my-app-id",
      user_id: "test-id",
      user_hash: "my-user-hash",
      name: "Test User",
      email: "test@example.com",
      created_at: undefined,
    });
  });

  test("calls Intercom with minimal params if user is not provided", () => {
    render(
      <IntercomClient isIntercomConfigured={true} intercomAppId="my-app-id" intercomUserHash="my-user-hash" />
    );

    expect(Intercom).toHaveBeenCalledTimes(1);
    expect(Intercom).toHaveBeenCalledWith({
      app_id: "my-app-id",
    });
  });

  test("does not call Intercom if isIntercomConfigured is false", () => {
    render(
      <IntercomClient
        isIntercomConfigured={false}
        intercomAppId="my-app-id"
        user={{ id: "whatever" } as TUser}
      />
    );

    expect(Intercom).not.toHaveBeenCalled();
  });

  test("shuts down Intercom on unmount", () => {
    const { unmount } = render(
      <IntercomClient isIntercomConfigured={true} intercomAppId="my-app-id" intercomUserHash="my-user-hash" />
    );

    // Reset call count; we only care about the shutdown after unmount
    mockWindowIntercom.mockClear();

    unmount();

    // Intercom should be shut down on unmount
    expect(mockWindowIntercom).toHaveBeenCalledWith("shutdown");
  });

  test("logs an error if Intercom initialization fails", () => {
    // Spy on console.error
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Force Intercom to throw an error on invocation
    vi.mocked(Intercom).mockImplementationOnce(() => {
      throw new Error("Intercom test error");
    });

    // Render the component with isIntercomConfigured=true so it tries to initialize
    render(
      <IntercomClient isIntercomConfigured={true} intercomAppId="my-app-id" intercomUserHash="my-user-hash" />
    );

    // Verify that console.error was called with the correct message
    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to initialize Intercom:", expect.any(Error));

    // Clean up the spy
    consoleErrorSpy.mockRestore();
  });

  test("logs an error if isIntercomConfigured is true but no intercomAppId is provided", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <IntercomClient
        isIntercomConfigured={true}
        // missing intercomAppId
        intercomUserHash="my-user-hash"
      />
    );

    // We expect a caught error: "Intercom app ID is required"
    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to initialize Intercom:", expect.any(Error));
    const [, caughtError] = consoleErrorSpy.mock.calls[0];
    expect((caughtError as Error).message).toBe("Intercom app ID is required");
    consoleErrorSpy.mockRestore();
  });

  test("logs an error if isIntercomConfigured is true but no intercomUserHash is provided", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const testUser = {
      id: "test-id",
      name: "Test User",
      email: "test@example.com",
    } as TUser;

    render(
      <IntercomClient
        isIntercomConfigured={true}
        intercomAppId="some-app-id"
        user={testUser}
        // missing intercomUserHash
      />
    );

    // We expect a caught error: "Intercom user hash is required"
    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to initialize Intercom:", expect.any(Error));
    const [, caughtError] = consoleErrorSpy.mock.calls[0];
    expect((caughtError as Error).message).toBe("Intercom user hash is required");
    consoleErrorSpy.mockRestore();
  });
});
