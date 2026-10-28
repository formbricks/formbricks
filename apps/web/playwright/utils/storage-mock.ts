import { type Page } from "@playwright/test";

const MOCK_STORAGE_UPLOAD_PATH = "/__playwright__/mock-storage-upload";

const MOCK_STORAGE_FILE = {
  mimeType: "image/svg+xml",
  buffer: Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#0f172a"/><circle cx="32" cy="32" r="18" fill="#22c55e"/></svg>`,
    "utf8"
  ),
};

const isClientStorageUrl = (url: URL): boolean => {
  const segments = url.pathname.split("/").filter(Boolean);

  return (
    segments.length === 5 &&
    segments[0] === "api" &&
    segments[1] === "v1" &&
    segments[2] === "client" &&
    segments[4] === "storage"
  );
};

/**
 * Respondent E2E tests exercise the survey runtime, which is not the right place to depend on browser
 * reachability to a real object-storage sidecar (some CI browsers run remotely). This mocks the storage
 * boundary the renderer talks to — the client storage endpoint, the presigned upload and the stored file —
 * so a spec stays scoped to survey behavior.
 */
export const mockStorageUploads = async (page: Page): Promise<void> => {
  await page.route(isClientStorageUrl, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    const payload = route.request().postDataJSON() as
      | { fileName?: string; surveyId?: string; elementId?: string }
      | undefined;
    const fileName = payload?.fileName ?? "uploaded-file.bin";
    const requestUrl = new URL(route.request().url());
    const appOrigin = requestUrl.origin;
    const workspaceId = requestUrl.pathname.split("/").filter(Boolean)[3] ?? "playwright-mock";
    const filePathSegments =
      payload?.surveyId && payload?.elementId
        ? ["surveys", payload.surveyId, "elements", payload.elementId]
        : [];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          signedUrl: `${appOrigin}${MOCK_STORAGE_UPLOAD_PATH}/${encodeURIComponent(fileName)}`,
          presignedFields: {
            key: fileName,
          },
          fileUrl: `/storage/${workspaceId}/private/${[...filePathSegments, encodeURIComponent(fileName)].join("/")}`,
          signingData: null,
          updatedFileName: fileName,
        },
      }),
    });
  });

  await page.route(`**${MOCK_STORAGE_UPLOAD_PATH}/**`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: "application/xml",
      body: `<?xml version="1.0" encoding="UTF-8"?><PostResponse><Location>${MOCK_STORAGE_UPLOAD_PATH}</Location></PostResponse>`,
    });
  });

  await page.route("**/storage/**", async (route) => {
    if (!["GET", "HEAD"].includes(route.request().method())) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: MOCK_STORAGE_FILE.mimeType,
      body: route.request().method() === "HEAD" ? "" : MOCK_STORAGE_FILE.buffer,
    });
  });
};
