import { redirect } from "next/navigation";
import { describe, expect, test, vi } from "vitest";
import Page from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("Settings Page", () => {
  test("should redirect to profile settings page", async () => {
    const params = { environmentId: "testEnvId" };
    await Page({ params });
    expect(redirect).toHaveBeenCalledWith(`/environments/${params.environmentId}/settings/profile`);
  });
});
