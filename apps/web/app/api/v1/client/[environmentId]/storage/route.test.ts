import { type NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";

const mocks = vi.hoisted(() => ({
  applyIPRateLimit: vi.fn(),
  applyRateLimit: vi.fn(),
  getSurvey: vi.fn(),
  getOrganizationByEnvironmentId: vi.fn(),
  getBiggerUploadFileSizePermission: vi.fn(),
  getSignedUrlForUpload: vi.fn(),
  getErrorResponseFromStorageError: vi.fn(),
  reportApiError: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyIPRateLimit: mocks.applyIPRateLimit,
  applyRateLimit: mocks.applyRateLimit,
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: mocks.getSurvey,
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationByEnvironmentId: mocks.getOrganizationByEnvironmentId,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getBiggerUploadFileSizePermission: mocks.getBiggerUploadFileSizePermission,
}));

vi.mock("@/modules/storage/service", () => ({
  getSignedUrlForUpload: mocks.getSignedUrlForUpload,
}));

vi.mock("@/modules/storage/utils", () => ({
  getErrorResponseFromStorageError: mocks.getErrorResponseFromStorageError,
}));

vi.mock("@/app/lib/api/api-error-reporter", () => ({
  reportApiError: mocks.reportApiError,
}));

vi.mock("@/app/api/v1/auth", () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEvent: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/constants", () => ({
  AUDIT_LOG_ENABLED: false,
  MAX_FILE_UPLOAD_SIZES: {
    standard: 1024 * 1024 * 10,
    big: 1024 * 1024 * 1024,
  },
  SENTRY_DSN: undefined,
}));

const ENVIRONMENT_ID = "cm1ubebtj000614kqe4hs3c67";
const OTHER_ENVIRONMENT_ID = "cm1ubebtj000714kqe4hs3c68";
const SURVEY_ID = "cm1ubebtj000814kqe4hs3c69";
const ORGANIZATION_ID = "cm1ubebtj000914kqe4hs3c70";

const createMockRequest = ({
  apiVersion = "v1",
  body = {
    fileName: "upload.png",
    fileType: "image/png",
    surveyId: SURVEY_ID,
  },
  environmentId = ENVIRONMENT_ID,
}: {
  apiVersion?: "v1" | "v2";
  body?: unknown;
  environmentId?: string;
} = {}): NextRequest => {
  const pathname = `/api/${apiVersion}/client/${environmentId}/storage`;

  return {
    method: "POST",
    url: `https://api.test${pathname}`,
    headers: {
      get: vi.fn(() => null),
    },
    nextUrl: {
      pathname,
    },
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
};

const createRouteProps = (environmentId = ENVIRONMENT_ID) => ({
  params: Promise.resolve({ environmentId }),
});

describe("api/v1 client storage route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.applyIPRateLimit.mockResolvedValue({ allowed: true });
    mocks.applyRateLimit.mockResolvedValue({ allowed: true });
    mocks.getSurvey.mockResolvedValue({ id: SURVEY_ID, environmentId: ENVIRONMENT_ID });
    mocks.getOrganizationByEnvironmentId.mockResolvedValue({ id: ORGANIZATION_ID });
    mocks.getBiggerUploadFileSizePermission.mockResolvedValue(false);
    mocks.getSignedUrlForUpload.mockResolvedValue({
      ok: true,
      data: {
        signedUrl: "https://s3.example.com/upload",
        presignedFields: { key: "value" },
        fileUrl: `/storage/${ENVIRONMENT_ID}/private/upload--fid--uuid.png`,
      },
    });
  });

  test("applies IP and environment rate limits before signing the upload", async () => {
    const { POST } = await import("./route");

    const response = await POST(createMockRequest(), createRouteProps());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        signedUrl: "https://s3.example.com/upload",
        presignedFields: { key: "value" },
        fileUrl: `/storage/${ENVIRONMENT_ID}/private/upload--fid--uuid.png`,
      },
    });

    expect(mocks.applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.storage.upload);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      rateLimitConfigs.storage.uploadPerEnvironment,
      ENVIRONMENT_ID
    );
    expect(mocks.getSignedUrlForUpload).toHaveBeenCalledWith(
      "upload.png",
      ENVIRONMENT_ID,
      "image/png",
      "private",
      1024 * 1024 * 10
    );
  });

  test("returns 429 with CORS when the environment rate limit is exceeded", async () => {
    const { POST } = await import("./route");
    mocks.applyRateLimit.mockRejectedValueOnce(
      new Error("Maximum number of requests reached. Please try again later.")
    );

    const response = await POST(createMockRequest(), createRouteProps());

    expect(response.status).toBe(429);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await response.json()).toEqual({
      code: "too_many_requests",
      message: "Maximum number of requests reached. Please try again later.",
      details: {},
    });
    expect(mocks.getSignedUrlForUpload).not.toHaveBeenCalled();
  });

  test("does not burn environment quota when the survey belongs to another environment", async () => {
    const { POST } = await import("./route");
    mocks.getSurvey.mockResolvedValueOnce({ id: SURVEY_ID, environmentId: OTHER_ENVIRONMENT_ID });

    const response = await POST(createMockRequest(), createRouteProps());

    expect(response.status).toBe(400);
    expect(mocks.applyRateLimit).not.toHaveBeenCalled();
    expect(mocks.getSignedUrlForUpload).not.toHaveBeenCalled();
  });

  test("applies the same environment rate limit through the v2 storage re-export", async () => {
    const { POST } = await import("@/app/api/v2/client/[environmentId]/storage/route");

    const response = await POST(createMockRequest({ apiVersion: "v2" }), createRouteProps());

    expect(response.status).toBe(200);
    expect(mocks.applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.storage.upload);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      rateLimitConfigs.storage.uploadPerEnvironment,
      ENVIRONMENT_ID
    );
  });
});
