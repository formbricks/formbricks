import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  removeOrganizationEmailLogo,
  sendOrganizationTestEmail,
  updateOrganizationEmailLogo,
} from "./api-client";

const ORG_ID = "clorg11111111111111111111";
const BASE = `/api/internal/organizations/${ORG_ID}`;
const LOGO_URL = "/storage/clwork1111111111111111111/public/logo.png";

const sentBody = () => JSON.parse(String(vi.mocked(global.fetch).mock.calls[0][1]?.body));

describe("email customization API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("PUTs the logo URL", async () => {
    routeFetch({
      [`PUT ${BASE}/email-logo`]: [json({ data: { organizationId: ORG_ID, logoUrl: LOGO_URL } })],
    });

    expect(await updateOrganizationEmailLogo(ORG_ID, LOGO_URL)).toEqual({
      organizationId: ORG_ID,
      logoUrl: LOGO_URL,
    });
    expect(sentBody()).toEqual({ logoUrl: LOGO_URL });
  });

  test("DELETEs the logo", async () => {
    routeFetch({ [`DELETE ${BASE}/email-logo`]: [new Response(null, { status: 204 })] });
    await expect(removeOrganizationEmailLogo(ORG_ID)).resolves.toBeUndefined();
  });

  test("surfaces a licence refusal as the server's message", async () => {
    const detail = "White label is not allowed for this organization";
    routeFetch({ [`PUT ${BASE}/email-logo`]: [json({ status: 403, detail }, 403)] });

    const failure = updateOrganizationEmailLogo(ORG_ID, LOGO_URL);
    await expect(failure).rejects.toBeInstanceOf(V3ApiError);
    await expect(failure).rejects.toMatchObject({ status: 403, detail });
  });

  test("POSTs a test email and waits for the SMTP server without a client timeout", async () => {
    routeFetch({ [`POST ${BASE}/test-emails`]: [json({ data: { emailSent: true } }, 202)] });
    const timeout = vi.spyOn(AbortSignal, "timeout");

    expect(await sendOrganizationTestEmail(ORG_ID)).toEqual({ emailSent: true });
    expect(timeout).not.toHaveBeenCalled();
  });
});
