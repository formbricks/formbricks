import { CheckFailure } from "../src/diagnostics.ts";
import { tierTest } from "../src/fixtures.ts";
import { readState } from "../src/run-state.ts";
import { STORAGE_NOT_CONFIGURED_CODES } from "../src/storage.ts";
import { FILE_ELEMENT_ID, TEST_PNG, buildStorageSurvey } from "../src/survey.ts";
import { createSurvey } from "../src/surveys-api.ts";

const test = tierTest("storage");

test("a file uploads and reads back", async ({ api, config }) => {
  test.skip(config.storage === "false", "CHECK_STORAGE=false");

  const { workspaceId } = readState();
  const surveyId = await createSurvey(api, buildStorageSurvey(workspaceId as string, new Date()));

  const presign = await api.post(
    `/api/v1/client/${workspaceId as string}/storage`,
    { fileName: "deployment-check.png", fileType: "image/png", surveyId, elementId: FILE_ELEMENT_ID },
    { authenticated: false, origin: "publicUrl" }
  );

  const code = (presign.json as { details?: { storage_error_code?: string } } | undefined)?.details
    ?.storage_error_code;
  if (presign.status >= 500 && code && STORAGE_NOT_CONFIGURED_CODES.has(code)) {
    test.skip(config.storage === "auto", "storage not configured (S3_* env vars unset or invalid)");
    throw new CheckFailure(
      "File storage",
      `the app cannot reach its S3 bucket (${code})`,
      "check S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_NAME and S3_ENDPOINT_URL"
    );
  }
  if (!presign.ok) {
    throw new CheckFailure(
      "File storage",
      `presigned upload request returned HTTP ${presign.status}`,
      "check the app logs"
    );
  }

  const data = (
    presign.json as { data: { signedUrl: string; fileUrl: string; presignedFields?: Record<string, string> } }
  ).data;
  const form = new FormData();
  for (const [key, value] of Object.entries(data.presignedFields ?? {})) form.append(key, value);
  form.append("file", new Blob([new Uint8Array(TEST_PNG)], { type: "image/png" }));

  const upload = await fetch(data.signedUrl, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(config.timeoutMs),
  }).catch((error: unknown) => {
    throw new CheckFailure(
      "File storage",
      `could not reach the bucket endpoint ${new URL(data.signedUrl).origin} (${error instanceof Error ? error.message : String(error)})`,
      "the bucket endpoint must be reachable from the machine running this check, not only from the app"
    );
  });
  if (!upload.ok) {
    throw new CheckFailure(
      "File storage",
      `uploading to the signed URL returned HTTP ${upload.status}`,
      "the bucket endpoint must be reachable from the machine running this check, not only from the app"
    );
  }

  const downloaded = await api.getBytes(
    data.fileUrl.startsWith("/") ? `${config.url}${data.fileUrl}` : data.fileUrl
  );
  if (downloaded.status !== 200 || !downloaded.bytes.equals(TEST_PNG)) {
    throw new CheckFailure(
      "File storage",
      `the uploaded file did not read back intact (HTTP ${downloaded.status}, ${downloaded.bytes.length} bytes)`,
      "check the storage route and bucket permissions"
    );
  }
});
