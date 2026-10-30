import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { HEIC_CONVERSION_BODY_LIMIT_BYTES, HEIC_CONVERSION_MAX_BASE64_LENGTH } from "./lib/constants";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  convert: vi.fn(),
  can: vi.fn(),
  assertCan: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("heic-convert", () => ({ default: mocks.convert }));
vi.mock("@/lib/authorization", () => ({ can: mocks.can, assertCan: mocks.assertCan }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const HEIC_BYTES = Buffer.from("....ftypheic fake image bytes");
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

/**
 * The route's concurrency slot is held until the response body has been sent, as it is for a browser, so
 * every request here reads its body to the end before the test looks at it.
 */
const post = async (body: unknown, headers: Record<string, string> = SAME_ORIGIN_HEADERS) => {
  const response = await POST(
    new NextRequest("http://localhost/api/internal/heic-conversions", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    {} as never
  );
  return new Response(await response.text(), { status: response.status, headers: response.headers });
};

const convertImage = (bytes: Buffer = HEIC_BYTES) => post({ image: bytes.toString("base64") });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.convert.mockResolvedValue(
    JPEG_BYTES.buffer.slice(JPEG_BYTES.byteOffset, JPEG_BYTES.byteOffset + JPEG_BYTES.length)
  );
});

describe("POST /api/internal/heic-conversions", () => {
  test("converts a HEIC image to a JPEG at quality 0.9 and returns it base64-encoded", async () => {
    const response = await convertImage();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      image: JPEG_BYTES.toString("base64"),
      contentType: "image/jpeg",
    });
    const [{ buffer, format, quality }] = mocks.convert.mock.calls[0];
    // The decoder reads bytes by index, so it must be handed a typed array holding exactly the upload.
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(buffer as Uint8Array).equals(HEIC_BYTES)).toBe(true);
    expect({ format, quality }).toEqual({ format: "JPEG", quality: 0.9 });
  });

  test("lets any signed-in user convert, as the server action did: no permission check, no audit", async () => {
    expect((await convertImage()).status).toBe(200);
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.assertCan).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("charges the conversion budget to the user instead of the general v3 one", async () => {
    await convertImage();
    expect(mocks.applyRateLimit.mock.calls.map(([config, id]) => [config.namespace, id])).toEqual([
      [rateLimitConfigs.api.internalHeicConversion.namespace, USER_ID],
    ]);
  });

  test("answers 429 once the user's conversion budget is spent, and converts nothing", async () => {
    mocks.applyRateLimit.mockRejectedValue(new TooManyRequestsError("Too many requests", 60));

    expect((await convertImage()).status).toBe(429);
    expect(mocks.convert).not.toHaveBeenCalled();
  });

  test("runs one conversion per user at a time: a second one while the first runs gets 429", async () => {
    let finish: (value: ArrayBuffer) => void = () => undefined;
    mocks.convert.mockImplementationOnce(() => new Promise<ArrayBuffer>((resolve) => (finish = resolve)));

    const first = convertImage();
    await vi.waitFor(() => expect(mocks.convert).toHaveBeenCalledTimes(1));
    const second = await convertImage();

    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBe("5");
    finish(new ArrayBuffer(1));
    expect((await first).status).toBe(200);
    expect((await convertImage()).status).toBe(200);
  });

  test("answers 422 for bytes the decoder can't read as HEIC", async () => {
    mocks.convert.mockRejectedValue(new TypeError("input buffer is not a HEIC image"));

    const response = await convertImage(Buffer.from("not an image"));

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe("The image is not a HEIC image that can be converted.");
  });

  test("converts an image of 2 MiB, the most the server action accepted, and refuses a byte more", async () => {
    const twoMiB = 2 * 1024 * 1024;
    expect((await convertImage(Buffer.alloc(twoMiB))).status).toBe(200);
    expect((await convertImage(Buffer.alloc(twoMiB + 1))).status).toBe(400);
    expect(mocks.convert).toHaveBeenCalledTimes(1);
  });

  test("answers 400 for an image one base64 block over the size limit", async () => {
    const image = "A".repeat(HEIC_CONVERSION_MAX_BASE64_LENGTH + 4);
    expect((await post({ image })).status).toBe(400);
    expect(mocks.convert).not.toHaveBeenCalled();
  });

  test("answers 413 for a body over the byte limit, before decoding anything", async () => {
    const image = "A".repeat(HEIC_CONVERSION_BODY_LIMIT_BYTES);
    expect((await post({ image })).status).toBe(413);
    expect(mocks.convert).not.toHaveBeenCalled();
  });

  test.each([
    ["no image", {}],
    ["an empty image", { image: "" }],
    ["an image that is not base64", { image: "not base64!" }],
    ["a field the route does not take", { image: HEIC_BYTES.toString("base64"), name: "photo.heic" }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await post(body)).status).toBe(400);
    expect(mocks.convert).not.toHaveBeenCalled();
  });

  test("answers 400 for a body that is not JSON", async () => {
    expect((await post("raw bytes")).status).toBe(400);
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await convertImage()).status).toBe(401);
    expect(mocks.convert).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    const response = await post({ image: HEIC_BYTES.toString("base64") }, { "sec-fetch-site": "cross-site" });
    expect(response.status).toBe(403);
    expect(mocks.convert).not.toHaveBeenCalled();
  });
});
