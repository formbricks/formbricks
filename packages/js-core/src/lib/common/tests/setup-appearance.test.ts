import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const add = vi.fn();
vi.mock("@/lib/common/command-queue", () => ({
  CommandType: { Setup: "setup", UserAction: "userAction", GeneralAction: "generalAction" },
  CommandQueue: { getInstance: () => ({ add, wait: vi.fn().mockResolvedValue(undefined) }) },
}));
vi.mock("@/lib/survey/no-code-action", () => ({ checkPageUrl: vi.fn() }));

describe("setup({ appearance })", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    add.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Loaded per test, after the setup file resets the module registry, so the test reads the same
  // appearance module instance as the SDK entry point.
  const load = async () => ({
    formbricks: (await import("@/index")).default,
    appearance: await import("@/lib/common/appearance"),
  });

  test("applies the appearance before setup is queued and keeps it out of the stored config", async () => {
    const { formbricks, appearance } = await load();
    let appearanceWhenQueued: string | undefined;
    add.mockImplementationOnce(() => {
      appearanceWhenQueued = appearance.getAppearance();
    });

    await formbricks.setup({ workspaceId: "ws_1", appUrl: "https://app.example.com", appearance: "dark" });

    expect(appearanceWhenQueued).toBe("dark");
    const passedConfig = add.mock.calls[0][3] as Record<string, unknown>;
    expect(passedConfig).toEqual({ workspaceId: "ws_1", appUrl: "https://app.example.com" });
    expect(passedConfig).not.toHaveProperty("appearance");
  });

  test("setAppearance works before setup and ignores unknown values", async () => {
    const { formbricks, appearance } = await load();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    formbricks.setAppearance("system");
    expect(appearance.getAppearance()).toBe("system");
    expect(add).not.toHaveBeenCalled();

    formbricks.setAppearance("sepia" as never);
    expect(appearance.getAppearance()).toBe("system");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
