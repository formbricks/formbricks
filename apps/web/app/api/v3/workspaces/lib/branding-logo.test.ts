import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { createPinnedDispatcher, validateAndResolveWebhookUrl } from "@/lib/utils/validate-webhook-url";
import { deleteFile, getSignedUrlForUpload } from "@/modules/storage/service";
import {
  LOGO_MAX_BYTES,
  LogoImageError,
  LogoStorageError,
  discardStoredLogo,
  downloadLogoImage,
  storeLogoImage,
} from "./branding-logo";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/utils/validate-webhook-url", () => ({
  validateAndResolveWebhookUrl: vi.fn(),
  createPinnedDispatcher: vi.fn(),
}));
vi.mock("@/modules/storage/service", () => ({ getSignedUrlForUpload: vi.fn(), deleteFile: vi.fn() }));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);

const imageResponse = (body: BodyInit | null, headers: Record<string, string> = {}, status = 200) =>
  new Response(body, { status, headers: { "content-type": "image/png", ...headers } });

const destroy = vi.fn();
const fetchMock = vi.fn();

describe("downloadLogoImage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(validateAndResolveWebhookUrl).mockResolvedValue({ ip: "93.184.216.34", family: 4 });
    vi.mocked(createPinnedDispatcher).mockReturnValue({ destroy } as never);
    destroy.mockResolvedValue(undefined);
  });

  afterEach(() => vi.unstubAllGlobals());

  test("downloads a png through the SSRF guard: validated, pinned, no redirects, closed afterwards", async () => {
    fetchMock.mockResolvedValue(imageResponse(PNG));

    const image = await downloadLogoImage("https://example.com/logo.png");

    expect(image).toMatchObject({ mime: "image/png", extension: "png" });
    expect(image.bytes).toEqual(PNG);
    expect(validateAndResolveWebhookUrl).toHaveBeenCalledWith("https://example.com/logo.png");
    expect(createPinnedDispatcher).toHaveBeenCalledWith({ ip: "93.184.216.34", family: 4 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/logo.png",
      expect.objectContaining({ redirect: "manual", dispatcher: { destroy } })
    );
    expect(destroy).toHaveBeenCalled();
  });

  test("accepts jpeg and webp by their real bytes", async () => {
    fetchMock.mockResolvedValueOnce(imageResponse(JPEG, { "content-type": "image/jpeg; charset=binary" }));
    expect(await downloadLogoImage("https://example.com/a")).toMatchObject({
      mime: "image/jpeg",
      extension: "jpg",
    });

    fetchMock.mockResolvedValueOnce(imageResponse(WEBP, { "content-type": "IMAGE/WEBP" }));
    expect(await downloadLogoImage("https://example.com/b")).toMatchObject({
      mime: "image/webp",
      extension: "webp",
    });
  });

  test("refuses a URL that resolves to a private or internal address, without fetching", async () => {
    vi.mocked(validateAndResolveWebhookUrl).mockRejectedValue(
      new InvalidInputError("Webhook URL must not point to private or internal IP addresses")
    );

    await expect(downloadLogoImage("https://10.0.0.5/logo.png")).rejects.toThrow(LogoImageError);
    await expect(downloadLogoImage("https://10.0.0.5/logo.png")).rejects.toThrow(/public address/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("refuses http, credentials and garbage before resolving anything", async () => {
    for (const url of ["http://example.com/logo.png", "https://user:pw@example.com/logo.png", "nope"]) {
      await expect(downloadLogoImage(url)).rejects.toThrow(LogoImageError);
    }
    expect(validateAndResolveWebhookUrl).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("refuses an image over 1 MB, by its declared length and by what the body really holds", async () => {
    fetchMock.mockResolvedValueOnce(imageResponse(PNG, { "content-length": String(LOGO_MAX_BYTES + 1) }));
    await expect(downloadLogoImage("https://example.com/big.png")).rejects.toThrow(/larger than 1 MB/);

    // No honest length: the cap is enforced while reading.
    const oversize = new Uint8Array(LOGO_MAX_BYTES + 10);
    oversize.set(PNG);
    fetchMock.mockResolvedValueOnce(imageResponse(oversize));
    await expect(downloadLogoImage("https://example.com/big.png")).rejects.toThrow(/larger than 1 MB/);
  });

  test("refuses types other than png, jpeg and webp, including svg", async () => {
    for (const type of ["image/svg+xml", "text/html", "image/gif", "application/octet-stream", ""]) {
      fetchMock.mockResolvedValueOnce(
        imageResponse("<svg xmlns='http://www.w3.org/2000/svg'/>", { "content-type": type })
      );
      await expect(downloadLogoImage("https://example.com/logo")).rejects.toThrow(/png, jpeg or webp/);
    }
  });

  test("refuses bytes that are not the type the server claimed", async () => {
    fetchMock.mockResolvedValueOnce(imageResponse("<html>not a png</html>"));
    await expect(downloadLogoImage("https://example.com/logo.png")).rejects.toThrow(/png, jpeg or webp/);

    fetchMock.mockResolvedValueOnce(imageResponse(JPEG, { "content-type": "image/png" }));
    await expect(downloadLogoImage("https://example.com/logo.png")).rejects.toThrow(/png, jpeg or webp/);
  });

  test("does not follow a redirect and reports other failures", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "http://10.0.0.1/" } })
    );
    await expect(downloadLogoImage("https://example.com/logo.png")).rejects.toThrow(/redirects/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(downloadLogoImage("https://example.com/logo.png")).rejects.toThrow(/status 404/);

    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    await expect(downloadLogoImage("https://example.com/logo.png")).rejects.toThrow(LogoImageError);
  });

  test("an operator-allowed internal host that needs no pinning still downloads", async () => {
    vi.mocked(validateAndResolveWebhookUrl).mockResolvedValue(null);
    fetchMock.mockResolvedValue(imageResponse(PNG));

    await downloadLogoImage("https://localhost/logo.png");

    expect(createPinnedDispatcher).not.toHaveBeenCalled();
  });
});

describe("storeLogoImage", () => {
  const image = { bytes: PNG, mime: "image/png", extension: "png" } as const;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(getSignedUrlForUpload).mockResolvedValue({
      ok: true,
      data: {
        signedUrl: "https://s3.example.com/bucket",
        presignedFields: { key: "ws/public/logo--fid--1.png", "Content-Type": "image/png" },
        fileUrl: "/storage/ws/public/logo--fid--1.png",
      },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  test("signs a public upload under the workspace, posts the file last and returns the storage url", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));

    const url = await storeLogoImage("ws", image);

    expect(url).toBe("/storage/ws/public/logo--fid--1.png");
    expect(getSignedUrlForUpload).toHaveBeenCalledWith(
      "logo.png",
      "ws",
      "image/png",
      "public",
      LOGO_MAX_BYTES
    );
    const [target, init] = fetchMock.mock.calls[0];
    expect(target).toBe("https://s3.example.com/bucket");
    const keys = [...(init.body as FormData).keys()];
    expect(keys).toEqual(["key", "Content-Type", "file"]);
  });

  test("an unsignable or refused upload is a storage error, not a bad request", async () => {
    vi.mocked(getSignedUrlForUpload).mockResolvedValueOnce({ ok: false, error: { code: "x" } } as never);
    await expect(storeLogoImage("ws", image)).rejects.toThrow(LogoStorageError);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(storeLogoImage("ws", image)).rejects.toThrow(LogoStorageError);

    fetchMock.mockRejectedValueOnce(new Error("down"));
    await expect(storeLogoImage("ws", image)).rejects.toThrow(LogoStorageError);
  });
});

describe("discardStoredLogo", () => {
  beforeEach(() => vi.resetAllMocks());

  test("deletes only a public object under the workspace's own prefix", async () => {
    await discardStoredLogo("ws", "/storage/ws/public/logo--fid--1.png");
    expect(deleteFile).toHaveBeenCalledExactlyOnceWith("ws", "public", "logo--fid--1.png");

    vi.mocked(deleteFile).mockClear();
    await discardStoredLogo("ws", "/storage/other/public/logo.png");
    await discardStoredLogo("ws", "/storage/ws/private/logo.png");
    await discardStoredLogo("ws", "https://elsewhere.example/logo.png");
    expect(deleteFile).not.toHaveBeenCalled();
  });
});
