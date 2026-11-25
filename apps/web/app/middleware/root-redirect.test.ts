import { beforeEach, describe, expect, test, vi } from "vitest";
import { readInstanceSetupState } from "@/lib/instance/setup-state";
import { getUnauthenticatedRootRedirectPath } from "./root-redirect";

// The freshness rule and its query strategy are `readInstanceSetupState`'s (setup-state.test.ts); this pins
// only how `/` maps each answer.
vi.mock("@/lib/instance/setup-state", () => ({ readInstanceSetupState: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getUnauthenticatedRootRedirectPath", () => {
  test("sends a never-set-up instance to the setup intro", async () => {
    vi.mocked(readInstanceSetupState).mockResolvedValue("fresh");

    await expect(getUnauthenticatedRootRedirectPath()).resolves.toBe("/setup/intro");
  });

  // ENG-7313: a set-up instance whose users are all gone is not fresh.
  test.each(["marked", "in-use"] as const)("sends a %s instance to login", async (state) => {
    vi.mocked(readInstanceSetupState).mockResolvedValue(state);

    await expect(getUnauthenticatedRootRedirectPath()).resolves.toBe("/auth/login");
  });
});
