import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { removeOrganizationFavicon, updateOrganizationFavicon } from "./api-client";

const ORG_ID = "clorg11111111111111111111";
const URL = `/api/internal/organizations/${ORG_ID}/favicon`;
const FAVICON_URL = "/storage/clwork1111111111111111111/public/favicon.png";

describe("favicon customization API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("PUTs the favicon URL", async () => {
    routeFetch({ [`PUT ${URL}`]: [json({ data: { organizationId: ORG_ID, faviconUrl: FAVICON_URL } })] });

    expect(await updateOrganizationFavicon(ORG_ID, FAVICON_URL)).toEqual({
      organizationId: ORG_ID,
      faviconUrl: FAVICON_URL,
    });
    expect(JSON.parse(String(vi.mocked(global.fetch).mock.calls[0][1]?.body))).toEqual({
      faviconUrl: FAVICON_URL,
    });
  });

  test("DELETEs the favicon", async () => {
    routeFetch({ [`DELETE ${URL}`]: [new Response(null, { status: 204 })] });
    await expect(removeOrganizationFavicon(ORG_ID)).resolves.toBeUndefined();
  });

  test("surfaces a licence refusal as the server's message", async () => {
    const detail = "White label is not allowed for this organization";
    routeFetch({ [`DELETE ${URL}`]: [json({ status: 403, detail }, 403)] });

    const failure = removeOrganizationFavicon(ORG_ID);
    await expect(failure).rejects.toBeInstanceOf(V3ApiError);
    await expect(failure).rejects.toMatchObject({ status: 403, detail });
  });
});
