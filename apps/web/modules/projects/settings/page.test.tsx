import { cleanup } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ProjectSettingsPage } from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("ProjectSettingsPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("redirects to the general project settings page", async () => {
    const params = { environmentId: "env-123" };
    await ProjectSettingsPage({ params: Promise.resolve(params) });
    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/environments/env-123/project/general");
  });
});
