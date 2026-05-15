import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getSurvey } from "@/lib/survey/service";
import { getBiggerUploadFileSizePermission } from "@/modules/ee/license-check/lib/utils";
import { getSignedUrlForUpload } from "@/modules/storage/service";
import { POST } from "./route";

vi.mock("@/app/lib/api/with-api-logging", async () => {
  return {
    withV1ApiWrapper:
      ({ handler }: { handler: any }) =>
      async (req: NextRequest, props: any) => {
        const result = await handler({ req, props });
        return result.response;
      },
  };
});

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationByEnvironmentId: vi.fn(),
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getBiggerUploadFileSizePermission: vi.fn(),
}));

vi.mock("@/modules/storage/service", () => ({
  getSignedUrlForUpload: vi.fn(),
}));

const environmentId = "ck12345678901234567890123";
const surveyId = "clq5n7p1q0000m7z0h5p6g3r2";

const props = {
  params: Promise.resolve({
    environmentId,
  }),
};

const signedUploadResponse = {
  ok: true,
  data: {
    signedUrl: "https://s3.example.com/upload",
    presignedFields: { key: "value" },
    fileUrl: `/storage/${environmentId}/private/report.pdf`,
  },
} as const;

const createRequest = (body: Record<string, unknown>) =>
  new NextRequest(`http://localhost/api/v1/client/${environmentId}/storage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

const createRequestBody = (overrides: Record<string, unknown> = {}) => ({
  fileName: "report.pdf",
  fileType: "application/pdf",
  surveyId,
  ...overrides,
});

const createSurvey = (overrides: Record<string, unknown> = {}) => ({
  id: surveyId,
  environmentId,
  blocks: [],
  questions: [],
  ...overrides,
});

describe("POST /api/v1/client/[environmentId]/storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue({ id: "org-123" } as any);
    vi.mocked(getBiggerUploadFileSizePermission).mockResolvedValue(false);
    vi.mocked(getSignedUrlForUpload).mockResolvedValue(signedUploadResponse as any);
  });

  test("creates a signed upload URL when a block file-upload element allows the extension", async () => {
    vi.mocked(getSurvey).mockResolvedValue(
      createSurvey({
        blocks: [
          {
            id: "block-1",
            name: "Block 1",
            elements: [
              {
                id: "element-1",
                type: "fileUpload",
                allowMultipleFiles: false,
                allowedFileExtensions: ["pdf"],
              },
            ],
          },
        ],
      }) as any
    );

    const response = await POST(createRequest(createRequestBody()), props);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: signedUploadResponse.data });
    expect(getSignedUrlForUpload).toHaveBeenCalledWith(
      "report.pdf",
      environmentId,
      "application/pdf",
      "private",
      expect.any(Number)
    );
  });

  test("creates a signed upload URL when a legacy file-upload question allows the extension", async () => {
    vi.mocked(getSurvey).mockResolvedValue(
      createSurvey({
        questions: [
          {
            id: "question-1",
            type: "fileUpload",
            allowMultipleFiles: false,
            allowedFileExtensions: ["png"],
          },
        ],
      }) as any
    );

    const response = await POST(
      createRequest(createRequestBody({ fileName: "screenshot.png", fileType: "image/png" })),
      props
    );

    expect(response.status).toBe(200);
    expect(getSignedUrlForUpload).toHaveBeenCalledWith(
      "screenshot.png",
      environmentId,
      "image/png",
      "private",
      expect.any(Number)
    );
  });

  test("rejects uploads when the survey has no file-upload elements or questions", async () => {
    vi.mocked(getSurvey).mockResolvedValue(
      createSurvey({
        blocks: [
          {
            id: "block-1",
            name: "Block 1",
            elements: [
              {
                id: "element-1",
                type: "openText",
                headline: { default: "Question" },
              },
            ],
          },
        ],
      }) as any
    );

    const response = await POST(createRequest(createRequestBody()), props);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "bad_request",
      message: "Survey does not allow file uploads",
    });
    expect(getSignedUrlForUpload).not.toHaveBeenCalled();
  });

  test("rejects uploads when the survey file-upload config does not allow the extension", async () => {
    vi.mocked(getSurvey).mockResolvedValue(
      createSurvey({
        blocks: [
          {
            id: "block-1",
            name: "Block 1",
            elements: [
              {
                id: "element-1",
                type: "fileUpload",
                allowMultipleFiles: false,
                allowedFileExtensions: ["png"],
              },
            ],
          },
        ],
      }) as any
    );

    const response = await POST(createRequest(createRequestBody()), props);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "bad_request",
      message: "File extension is not allowed for this survey",
    });
    expect(getSignedUrlForUpload).not.toHaveBeenCalled();
  });

  test("allows globally safe extensions when a survey file-upload entry has no extension restriction", async () => {
    vi.mocked(getSurvey).mockResolvedValue(
      createSurvey({
        blocks: [
          {
            id: "block-1",
            name: "Block 1",
            elements: [
              {
                id: "element-1",
                type: "fileUpload",
                allowMultipleFiles: false,
              },
            ],
          },
        ],
      }) as any
    );

    const response = await POST(createRequest(createRequestBody()), props);

    expect(response.status).toBe(200);
    expect(getSignedUrlForUpload).toHaveBeenCalledWith(
      "report.pdf",
      environmentId,
      "application/pdf",
      "private",
      expect.any(Number)
    );
  });
});
