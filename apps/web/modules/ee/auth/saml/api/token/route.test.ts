import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

const { token } = vi.hoisted(() => ({ token: vi.fn() }));

vi.mock("@/modules/ee/auth/saml/lib/jackson", () => ({
  default: async () => ({ oauthController: { token } }),
}));

const tokenRequest = (contentType: string, body: BodyInit) =>
  new Request("http://localhost/api/auth/saml/token", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });

describe("POST /api/auth/saml/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    token.mockResolvedValue({ access_token: "token" });
  });

  test("passes a form-encoded token request to jackson", async () => {
    const response = await POST(
      tokenRequest("application/x-www-form-urlencoded", "grant_type=authorization_code&code=abc")
    );

    expect(response.status).toBe(200);
    expect(token).toHaveBeenCalledWith(
      expect.objectContaining({ grant_type: "authorization_code", code: "abc" })
    );
  });

  test("refuses a multipart body before reading its fields", async () => {
    const form = new FormData();
    form.set("grant_type", "authorization_code");
    const multipart = new Request("http://localhost", { method: "POST", body: form });

    const response = await POST(
      tokenRequest(
        multipart.headers.get("content-type") ?? "multipart/form-data",
        await multipart.arrayBuffer()
      )
    );

    expect(response.status).toBe(400);
    expect(token).not.toHaveBeenCalled();
  });
});
