import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CsvImportValidationError, importCsvFile } from "@/lib/feedback-source/csv-file-import";
import { getUser } from "@/lib/user/service";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromFeedbackSourceId } from "@/lib/utils/helper";
import {
  CSV_FILE_TOO_LARGE_ERROR_CODE,
  CSV_INCONSISTENT_COLUMNS_ERROR_CODE,
  MAX_CSV_VALUES,
} from "@/modules/ee/unify-feedback/sources/types";
import { POST } from "./route";

const csvFileImportMock = vi.hoisted(() => {
  class MockCsvImportValidationError extends Error {
    readonly code: string;
    readonly row?: number;
    readonly max?: number;

    constructor(code: string, options: { row?: number; max?: number } = {}) {
      super(code);
      this.name = "CsvImportValidationError";
      this.code = code;
      this.row = options.row;
      this.max = options.max;
    }
  }

  return {
    CsvImportValidationError: MockCsvImportValidationError,
    importCsvFile: vi.fn(),
  };
});

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));

vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromFeedbackSourceId: vi.fn(),
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: vi.fn(),
}));

vi.mock("@/lib/feedback-source/csv-file-import", () => csvFileImportMock);

const createImportRequest = (formData: FormData, headers?: HeadersInit) =>
  new Request("http://localhost/api/unify-feedback/sources/csv/import", {
    method: "POST",
    body: formData,
    headers,
  });

const createFormData = () => {
  const formData = new FormData();
  formData.append("workspaceId", "workspace-1");
  formData.append("feedbackSourceId", "source-1");
  formData.append(
    "file",
    new File(["submission_id,field_id\nsub-1,q1"], "feedback.csv", { type: "text/csv" })
  );

  return formData;
};

const mockAuthenticatedUser = () => {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1" } } as never);
  vi.mocked(getUser).mockResolvedValue({ id: "user-1" } as never);
  vi.mocked(getOrganizationIdFromFeedbackSourceId).mockResolvedValue("org-1");
  vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);
};

describe("CSV import route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects oversized multipart requests before auth", async () => {
    const response = await POST(
      new Request("http://localhost/api/unify-feedback/sources/csv/import", {
        method: "POST",
        headers: { "content-length": (MAX_CSV_VALUES.FILE_SIZE + 1024 * 1024 + 1).toString() },
      })
    );

    await expect(response.json()).resolves.toEqual({
      error: CSV_FILE_TOO_LARGE_ERROR_CODE,
      max: MAX_CSV_VALUES.FILE_SIZE,
    });
    expect(response.status).toBe(413);
    expect(getServerSession).not.toHaveBeenCalled();
  });

  test("returns 401 for unauthenticated users", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await POST(createImportRequest(createFormData()));

    await expect(response.json()).resolves.toEqual({ error: "Not authenticated" });
    expect(response.status).toBe(401);
  });

  test("imports a CSV file for authorized users", async () => {
    mockAuthenticatedUser();
    vi.mocked(importCsvFile).mockResolvedValue({ successes: 1, failures: 0, skipped: 0 });

    const response = await POST(createImportRequest(createFormData()));

    await expect(response.json()).resolves.toEqual({ successes: 1, failures: 0, skipped: 0 });
    expect(response.status).toBe(200);
    expect(checkAuthorizationUpdated).toHaveBeenCalledWith({
      userId: "user-1",
      organizationId: "org-1",
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        { type: "workspaceTeam", minPermission: "readWrite", workspaceId: "workspace-1" },
      ],
    });
    expect(importCsvFile).toHaveBeenCalledWith({
      feedbackSourceId: "source-1",
      workspaceId: "workspace-1",
      file: expect.objectContaining({ name: "feedback.csv" }),
    });
  });

  test("returns CSV validation errors with details", async () => {
    mockAuthenticatedUser();
    vi.mocked(importCsvFile).mockRejectedValue(
      new CsvImportValidationError(CSV_INCONSISTENT_COLUMNS_ERROR_CODE, { row: 2 })
    );

    const response = await POST(createImportRequest(createFormData()));

    await expect(response.json()).resolves.toEqual({
      error: CSV_INCONSISTENT_COLUMNS_ERROR_CODE,
      row: 2,
    });
    expect(response.status).toBe(400);
  });
});
