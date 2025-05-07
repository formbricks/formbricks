import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TEnvironmentAuth } from "@/modules/environments/types/environment-auth";
import { cleanup } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ProjectSettingsLayout } from "./layout";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));

describe("ProjectSettingsLayout", () => {
  afterEach(() => {
    cleanup();
  });

  test("redirects to billing if isBilling is true", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({ isBilling: true } as TEnvironmentAuth);
    const props = { params: { environmentId: "env-1" }, children: <div>child</div> };
    await ProjectSettingsLayout(props);
    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/environments/env-1/settings/billing");
  });

  test("renders children if isBilling is false", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({ isBilling: false } as TEnvironmentAuth);
    const props = { params: { environmentId: "env-2" }, children: <div>child</div> };
    const result = await ProjectSettingsLayout(props);
    expect(result).toEqual(<div>child</div>);
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });

  test("throws error if getEnvironmentAuth throws", async () => {
    const error = new Error("fail");
    vi.mocked(getEnvironmentAuth).mockRejectedValue(error);
    const props = { params: { environmentId: "env-3" }, children: <div>child</div> };
    await expect(ProjectSettingsLayout(props)).rejects.toThrow(error);
  });
});
