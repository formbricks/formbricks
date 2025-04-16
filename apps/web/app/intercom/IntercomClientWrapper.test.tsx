import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TUser } from "@formbricks/types/user";
import { IntercomClientWrapper } from "./IntercomClientWrapper";

vi.mock("@formbricks/lib/constants", () => ({
  IS_INTERCOM_CONFIGURED: true,
  INTERCOM_APP_ID: "mock-intercom-app-id",
  INTERCOM_SECRET_KEY: "mock-intercom-secret-key",
}));

// Mock the crypto createHmac function to return a fake hash.
// Vite global setup doesn't work here due to Intercom probably using crypto themselves.
vi.mock("crypto", () => ({
  default: {
    createHmac: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue("fake-hash"),
    })),
  },
}));

vi.mock("./IntercomClient", () => ({
  IntercomClient: (props: any) => (
    <div data-testid="mock-intercom-client" data-props={JSON.stringify(props)} />
  ),
}));

describe("IntercomClientWrapper", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders IntercomClient with computed user hash when user is provided", () => {
    const testUser = { id: "user-123", name: "Test User", email: "test@example.com" } as TUser;

    render(<IntercomClientWrapper user={testUser} />);

    const intercomClientEl = screen.getByTestId("mock-intercom-client");
    expect(intercomClientEl).toBeInTheDocument();

    const props = JSON.parse(intercomClientEl.getAttribute("data-props") ?? "{}");

    // Check that the computed hash equals "fake-hash" (as per our crypto mock)
    expect(props.intercomUserHash).toBe("fake-hash");
    expect(props.intercomAppId).toBe("mock-intercom-app-id");
    expect(props.isIntercomConfigured).toBe(true);
    expect(props.user).toEqual(testUser);
  });

  test("renders IntercomClient without computing a hash when no user is provided", () => {
    render(<IntercomClientWrapper user={null} />);

    const intercomClientEl = screen.getByTestId("mock-intercom-client");
    expect(intercomClientEl).toBeInTheDocument();

    const props = JSON.parse(intercomClientEl.getAttribute("data-props") ?? "{}");

    expect(props.intercomUserHash).toBeUndefined();
    expect(props.intercomAppId).toBe("mock-intercom-app-id");
    expect(props.isIntercomConfigured).toBe(true);
    expect(props.user).toBeNull();
  });
});
