import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { Session } from "next-auth";
import { usePostHog } from "posthog-js/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganizationBilling } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import { PosthogIdentify } from "./PosthogIdentify";

type PartialPostHog = Partial<ReturnType<typeof usePostHog>>;

vi.mock("posthog-js/react", () => ({
  usePostHog: vi.fn(),
}));

describe("PosthogIdentify", () => {
  beforeEach(() => {
    cleanup();
  });

  test("identifies the user and sets groups when isPosthogEnabled is true", () => {
    const mockIdentify = vi.fn();
    const mockGroup = vi.fn();

    const mockPostHog: PartialPostHog = {
      identify: mockIdentify,
      group: mockGroup,
    };

    vi.mocked(usePostHog).mockReturnValue(mockPostHog as ReturnType<typeof usePostHog>);

    render(
      <PosthogIdentify
        session={{ user: { id: "user-123" } } as Session}
        user={
          {
            name: "Test User",
            email: "test@example.com",
            role: "engineer",
            objective: "increase_conversion",
          } as TUser
        }
        environmentId="env-456"
        organizationId="org-789"
        organizationName="Test Org"
        organizationBilling={
          {
            plan: "enterprise",
            limits: { monthly: { responses: 1000, miu: 5000 }, projects: 10 },
          } as TOrganizationBilling
        }
        isPosthogEnabled
      />
    );

    // verify that identify is called with the session user id + extra info
    expect(mockIdentify).toHaveBeenCalledWith("user-123", {
      name: "Test User",
      email: "test@example.com",
      role: "engineer",
      objective: "increase_conversion",
    });

    // environment + organization groups
    expect(mockGroup).toHaveBeenCalledTimes(2);
    expect(mockGroup).toHaveBeenCalledWith("environment", "env-456", { name: "env-456" });
    expect(mockGroup).toHaveBeenCalledWith("organization", "org-789", {
      name: "Test Org",
      plan: "enterprise",
      responseLimit: 1000,
      miuLimit: 5000,
    });
  });

  test("does nothing if isPosthogEnabled is false", () => {
    const mockIdentify = vi.fn();
    const mockGroup = vi.fn();

    const mockPostHog: PartialPostHog = {
      identify: mockIdentify,
      group: mockGroup,
    };

    vi.mocked(usePostHog).mockReturnValue(mockPostHog as ReturnType<typeof usePostHog>);

    render(
      <PosthogIdentify
        session={{ user: { id: "user-123" } } as Session}
        user={{ name: "Test User", email: "test@example.com" } as TUser}
        isPosthogEnabled={false}
      />
    );

    expect(mockIdentify).not.toHaveBeenCalled();
    expect(mockGroup).not.toHaveBeenCalled();
  });

  test("does nothing if session user is missing", () => {
    const mockIdentify = vi.fn();
    const mockGroup = vi.fn();

    const mockPostHog: PartialPostHog = {
      identify: mockIdentify,
      group: mockGroup,
    };

    vi.mocked(usePostHog).mockReturnValue(mockPostHog as ReturnType<typeof usePostHog>);

    render(
      <PosthogIdentify
        // no user in session
        session={{} as any}
        user={{ name: "Test User", email: "test@example.com" } as TUser}
        isPosthogEnabled
      />
    );

    // Because there's no session.user, we skip identify
    expect(mockIdentify).not.toHaveBeenCalled();
    expect(mockGroup).not.toHaveBeenCalled();
  });

  test("identifies user but does not group if environmentId/organizationId not provided", () => {
    const mockIdentify = vi.fn();
    const mockGroup = vi.fn();

    const mockPostHog: PartialPostHog = {
      identify: mockIdentify,
      group: mockGroup,
    };

    vi.mocked(usePostHog).mockReturnValue(mockPostHog as ReturnType<typeof usePostHog>);

    render(
      <PosthogIdentify
        session={{ user: { id: "user-123" } } as Session}
        user={{ name: "Test User", email: "test@example.com" } as TUser}
        isPosthogEnabled
      />
    );

    expect(mockIdentify).toHaveBeenCalledWith("user-123", {
      name: "Test User",
      email: "test@example.com",
      role: undefined,
      objective: undefined,
    });
    // No environmentId or organizationId => no group calls
    expect(mockGroup).not.toHaveBeenCalled();
  });
});
