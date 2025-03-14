import Intercom from "@intercom/messenger-js-sdk";
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TUser } from "@formbricks/types/user";
import { IntercomClient } from "./IntercomClient";

// Mock the Intercom package
vi.mock("@intercom/messenger-js-sdk", () => ({
  default: vi.fn(),
}));

// Mock the crypto createHmac function to return a fake hash.
// Vite global setup doens't work here due to Intercom probably using crypto themselves.
vi.mock("crypto", () => ({
  default: {
    createHmac: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue("fake-hash"),
    })),
  },
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

  it("calls Intercom with user data when isIntercomConfigured is true and user is provided", () => {
    const testUser = {
      id: "test-id",
      name: "Test User",
      email: "test@example.com",
      createdAt: new Date("2020-01-01T00:00:00Z"),
    } as TUser;

    render(
      <IntercomClient
        isIntercomConfigured={true}
        intercomSecretKey="my-secret-key"
        intercomAppId="my-app-id"
        user={testUser}
      />
    );

    // Verify Intercom was called with the expected params
    expect(Intercom).toHaveBeenCalledTimes(1);
    expect(Intercom).toHaveBeenCalledWith({
      app_id: "my-app-id",
      user_id: "test-id",
      user_hash: "fake-hash",
      name: "Test User",
      email: "test@example.com",
      created_at: 1577836800, // Epoch for 2020-01-01T00:00:00Z
    });
  });

  it("calls Intercom with user data without createdAt", () => {
    const testUser = {
      id: "test-id",
      name: "Test User",
      email: "test@example.com",
    } as TUser;

    render(
      <IntercomClient
        isIntercomConfigured={true}
        intercomSecretKey="my-secret-key"
        intercomAppId="my-app-id"
        user={testUser}
      />
    );

    // Verify Intercom was called with the expected params
    expect(Intercom).toHaveBeenCalledTimes(1);
    expect(Intercom).toHaveBeenCalledWith({
      app_id: "my-app-id",
      user_id: "test-id",
      user_hash: "fake-hash",
      name: "Test User",
      email: "test@example.com",
      created_at: undefined,
    });
  });

  it("calls Intercom with minimal params if user is not provided", () => {
    render(
      <IntercomClient
        isIntercomConfigured={true}
        intercomAppId="my-app-id"
        intercomSecretKey="my-secret-key"
      />
    );

    expect(Intercom).toHaveBeenCalledTimes(1);
    expect(Intercom).toHaveBeenCalledWith({
      app_id: "my-app-id",
    });
  });

  it("does not call Intercom if isIntercomConfigured is false", () => {
    render(
      <IntercomClient
        isIntercomConfigured={false}
        intercomAppId="my-app-id"
        user={{ id: "whatever" } as TUser}
      />
    );

    expect(Intercom).not.toHaveBeenCalled();
  });

  it("shuts down Intercom on unmount", () => {
    const { unmount } = render(
      <IntercomClient isIntercomConfigured={true} intercomAppId="my-app-id" intercomSecretKey="secret-key" />
    );

    // Reset call count; we only care about the shutdown after unmount
    mockWindowIntercom.mockClear();

    unmount();

    // Intercom should be shut down on unmount
    expect(mockWindowIntercom).toHaveBeenCalledWith("shutdown");
  });

  it("logs an error if Intercom initialization fails", () => {
    // Spy on console.error
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Force Intercom to throw an error on invocation
    vi.mocked(Intercom).mockImplementationOnce(() => {
      throw new Error("Intercom test error");
    });

    // Render the component with isIntercomConfigured=true so it tries to initialize
    render(
      <IntercomClient
        isIntercomConfigured={true}
        intercomAppId="my-app-id"
        intercomSecretKey="my-secret-key"
      />
    );

    // Verify that console.error was called with the correct message
    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to initialize Intercom:", expect.any(Error));

    // Clean up the spy
    consoleErrorSpy.mockRestore();
  });

  it("logs an error if isIntercomConfigured is true but no intercomAppId is provided", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <IntercomClient
        isIntercomConfigured={true}
        // missing intercomAppId
        intercomSecretKey="some-secret"
      />
    );

    // We expect a caught error: "Intercom app ID is required"
    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to initialize Intercom:", expect.any(Error));
    const [, caughtError] = consoleErrorSpy.mock.calls[0];
    expect((caughtError as Error).message).toBe("Intercom app ID is required");
    consoleErrorSpy.mockRestore();
  });

  it("logs an error if isIntercomConfigured is true but no intercomSecretKey is provided", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <IntercomClient
        isIntercomConfigured={true}
        intercomAppId="some-app-id"
        // missing intercomSecretKey
      />
    );

    // We expect a caught error: "Intercom secret key is required"
    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to initialize Intercom:", expect.any(Error));
    const [, caughtError] = consoleErrorSpy.mock.calls[0];
    expect((caughtError as Error).message).toBe("Intercom secret key is required");
    consoleErrorSpy.mockRestore();
  });
});
