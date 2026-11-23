import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { createAdditionalOrganization } from "./api-client";

const URL = "/api/internal/organizations";
const sentBody = () => JSON.parse(String(vi.mocked(global.fetch).mock.calls[0][1]?.body));

describe("organization API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("POSTs an additional organization and returns its id and name", async () => {
    const created = { id: "clorg11111111111111111111", name: "Acme" };
    routeFetch({ [`POST ${URL}`]: [json({ data: created }, 201)] });

    expect(await createAdditionalOrganization("Acme")).toEqual(created);
    expect(sentBody()).toEqual({ name: "Acme", flow: "additional" });
  });

  test("surfaces the licence refusal's reason", async () => {
    const detail = "Creating Multiple organization is restricted on your instance of Formbricks";
    routeFetch({ [`POST ${URL}`]: [json({ status: 403, detail }, 403)] });

    const failure = createAdditionalOrganization("Acme");
    await expect(failure).rejects.toBeInstanceOf(V3ApiError);
    await expect(failure).rejects.toMatchObject({ status: 403, detail });
  });
});
