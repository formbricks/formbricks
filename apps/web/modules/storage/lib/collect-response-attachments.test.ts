import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { findWorkspaceByIdOrLegacyEnvId } from "@/lib/utils/resolve-client-id";
import { collectResponseAttachments } from "./collect-response-attachments";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@formbricks/database", () => ({
  prisma: { response: { findMany: vi.fn() } },
}));

vi.mock("@/lib/utils/resolve-client-id", () => ({
  findWorkspaceByIdOrLegacyEnvId: vi.fn(),
}));

const mockedFindMany = vi.mocked(prisma.response.findMany);
const mockedResolveWorkspace = vi.mocked(findWorkspaceByIdOrLegacyEnvId);

const WORKSPACE_ID = "ws-own";
const FOREIGN_WORKSPACE_ID = "ws-victim";
const UPLOAD_ELEMENT_ID = "el-upload";
const SECOND_UPLOAD_ELEMENT_ID = "el-upload-2";

const i18n = (value: string) => ({ default: value });

const buildBlocksSurvey = (): TSurvey =>
  ({
    id: "survey-1",
    workspaceId: WORKSPACE_ID,
    questions: [],
    blocks: [
      {
        id: "block-1",
        name: "Block 1",
        elements: [
          { id: "el-text", type: "openText", headline: i18n("Your name") },
          { id: UPLOAD_ELEMENT_ID, type: "fileUpload", headline: i18n("Upload a photo") },
          { id: SECOND_UPLOAD_ELEMENT_ID, type: "fileUpload", headline: i18n("Upload a receipt") },
        ],
      },
    ],
  }) as unknown as TSurvey;

const buildLegacyQuestionsSurvey = (): TSurvey =>
  ({
    id: "survey-legacy",
    workspaceId: WORKSPACE_ID,
    blocks: [],
    questions: [
      { id: "q-text", type: "openText", headline: i18n("Your name") },
      { id: UPLOAD_ELEMENT_ID, type: "fileUpload", headline: i18n("Upload a photo") },
    ],
  }) as unknown as TSurvey;

const response = (
  id: string,
  data: Record<string, unknown>,
  createdAt = new Date("2026-09-01T10:00:00Z")
) => ({
  id,
  createdAt,
  data,
});

/** One batch, then an empty result so the collector stops. */
const respondWithBatches = (...batches: unknown[][]) => {
  batches.forEach((batch) => mockedFindMany.mockResolvedValueOnce(batch as never));
};

describe("collectResponseAttachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResolveWorkspace.mockResolvedValue({ id: WORKSPACE_ID, organizationId: "org-1" });
  });

  test("collects a file-upload answer from a blocks survey with its element label and index", async () => {
    respondWithBatches([
      response("res-1", { [UPLOAD_ELEMENT_ID]: [`/storage/${WORKSPACE_ID}/private/photo.jpg`] }),
    ]);

    const result = await collectResponseAttachments({ survey: buildBlocksSurvey(), maxFiles: 100 });

    expect(result.fileCount).toBe(1);
    expect(result.responseCount).toBe(1);
    expect(result.exceedsMaxFiles).toBe(false);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      // Element index 2: the open-text element is first in the survey.
      zipPath: "2026-09-01T10-00-00_res-1/2_Upload a photo/photo.jpg",
      responseId: "res-1",
      elementId: UPLOAD_ELEMENT_ID,
      elementLabel: "Upload a photo",
      status: "ok",
      storage: { storageId: WORKSPACE_ID, accessType: "private", fileName: "photo.jpg" },
    });
  });

  test("collects from a legacy questions survey too", async () => {
    // Keying off blocks alone would silently export nothing for a questions-based survey.
    respondWithBatches([
      response("res-1", { [UPLOAD_ELEMENT_ID]: [`/storage/${WORKSPACE_ID}/private/scan.pdf`] }),
    ]);

    const result = await collectResponseAttachments({
      survey: buildLegacyQuestionsSurvey(),
      maxFiles: 100,
    });

    expect(result.fileCount).toBe(1);
    expect(result.entries[0].zipPath).toBe("2026-09-01T10-00-00_res-1/2_Upload a photo/scan.pdf");
  });

  test("ignores answers to elements that are not file uploads", async () => {
    respondWithBatches([
      response("res-1", {
        "el-text": "Ada",
        [UPLOAD_ELEMENT_ID]: [`/storage/${WORKSPACE_ID}/private/photo.jpg`],
      }),
    ]);

    const result = await collectResponseAttachments({ survey: buildBlocksSurvey(), maxFiles: 100 });

    expect(result.fileCount).toBe(1);
  });

  test("drops a file stored outside the survey's workspace and reports it", async () => {
    // The cross-tenant guard: write-time validation can be bypassed via the element-id flip TOCTOU
    // documented in delete-response-files.ts, so a planted foreign URL must never be streamed out.
    mockedResolveWorkspace.mockResolvedValue({ id: FOREIGN_WORKSPACE_ID, organizationId: "org-2" });
    respondWithBatches([
      response("res-1", { [UPLOAD_ELEMENT_ID]: [`/storage/${FOREIGN_WORKSPACE_ID}/private/secret.pdf`] }),
    ]);

    const result = await collectResponseAttachments({ survey: buildBlocksSurvey(), maxFiles: 100 });

    expect(result.fileCount).toBe(0);
    expect(result.responseCount).toBe(0);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      status: "skipped_foreign_workspace",
      zipPath: "",
    });
    // No storage coordinates at all: nothing downstream can accidentally stream it.
    expect(result.entries[0].storage).toBeUndefined();
  });

  test("drops an unparseable URL and reports it", async () => {
    respondWithBatches([response("res-1", { [UPLOAD_ELEMENT_ID]: ["https://evil.example.com/x.png"] })]);

    const result = await collectResponseAttachments({ survey: buildBlocksSurvey(), maxFiles: 100 });

    expect(result.fileCount).toBe(0);
    expect(result.entries[0].status).toBe("skipped_invalid_url");
  });

  test("skips a URL with malformed percent-encoding instead of aborting the export", async () => {
    // `decodeURIComponent` throws `URIError` on a bare `%`, and response data is attacker-supplied, so
    // one bad answer must not take the whole archive down with it.
    respondWithBatches([
      response("res-1", {
        [UPLOAD_ELEMENT_ID]: [
          `/storage/${WORKSPACE_ID}/private/%`,
          `/storage/${WORKSPACE_ID}/private/good.jpg`,
        ],
      }),
    ]);

    const result = await collectResponseAttachments({ survey: buildBlocksSurvey(), maxFiles: 100 });

    expect(result.entries.map((entry) => entry.status)).toEqual(["skipped_invalid_url", "ok"]);
    expect(result.fileCount).toBe(1);
  });

  test("ignores non-string entries in a file-upload answer", async () => {
    respondWithBatches([response("res-1", { [UPLOAD_ELEMENT_ID]: [null, 42] })]);

    const result = await collectResponseAttachments({ survey: buildBlocksSurvey(), maxFiles: 100 });

    expect(result.entries).toHaveLength(0);
  });

  test("resolves each distinct storage id once, not once per file", async () => {
    respondWithBatches([
      response("res-1", {
        [UPLOAD_ELEMENT_ID]: [
          `/storage/${WORKSPACE_ID}/private/a.jpg`,
          `/storage/${WORKSPACE_ID}/private/b.jpg`,
        ],
        [SECOND_UPLOAD_ELEMENT_ID]: [`/storage/${WORKSPACE_ID}/private/c.jpg`],
      }),
    ]);

    const result = await collectResponseAttachments({ survey: buildBlocksSurvey(), maxFiles: 100 });

    expect(result.fileCount).toBe(3);
    expect(mockedResolveWorkspace).toHaveBeenCalledTimes(1);
  });

  test("counts a response once however many files it contributed", async () => {
    respondWithBatches([
      response("res-1", {
        [UPLOAD_ELEMENT_ID]: [
          `/storage/${WORKSPACE_ID}/private/a.jpg`,
          `/storage/${WORKSPACE_ID}/private/b.jpg`,
        ],
      }),
    ]);

    const result = await collectResponseAttachments({ survey: buildBlocksSurvey(), maxFiles: 100 });

    expect(result.fileCount).toBe(2);
    expect(result.responseCount).toBe(1);
  });

  test("de-duplicates identical file names within one element", async () => {
    respondWithBatches([
      response("res-1", {
        [UPLOAD_ELEMENT_ID]: [
          `/storage/${WORKSPACE_ID}/private/photo.jpg`,
          `/storage/${WORKSPACE_ID}/private/photo.jpg`,
        ],
      }),
    ]);

    const result = await collectResponseAttachments({ survey: buildBlocksSurvey(), maxFiles: 100 });

    expect(result.entries.map((entry) => entry.zipPath)).toEqual([
      "2026-09-01T10-00-00_res-1/2_Upload a photo/photo.jpg",
      "2026-09-01T10-00-00_res-1/2_Upload a photo/photo (2).jpg",
    ]);
  });

  test("decodes the stored file name so the storage key matches", async () => {
    // Upload percent-encodes the name into the URL; the object lives under the decoded name.
    respondWithBatches([
      response("res-1", { [UPLOAD_ELEMENT_ID]: [`/storage/${WORKSPACE_ID}/private/my%20photo.jpg`] }),
    ]);

    const result = await collectResponseAttachments({ survey: buildBlocksSurvey(), maxFiles: 100 });

    expect(result.entries[0].storage?.fileName).toBe("my photo.jpg");
  });

  test("scopes the query to the survey and passes the filter criteria through", async () => {
    respondWithBatches([]);

    await collectResponseAttachments({
      survey: buildBlocksSurvey(),
      filterCriteria: { finished: true },
      maxFiles: 100,
    });

    const where = mockedFindMany.mock.calls[0][0]?.where as Record<string, unknown>;
    expect(where.surveyId).toBe("survey-1");
    expect(JSON.stringify(where)).toContain('"finished":true');
  });

  test("pages with a cursor until a short batch arrives", async () => {
    const fileFor = (id: string) => ({
      [UPLOAD_ELEMENT_ID]: [`/storage/${WORKSPACE_ID}/private/${id}.jpg`],
    });
    respondWithBatches(
      [response("res-1", fileFor("a")), response("res-2", fileFor("b"))],
      [response("res-3", fileFor("c"))]
    );

    const result = await collectResponseAttachments({
      survey: buildBlocksSurvey(),
      maxFiles: 100,
      batchSize: 2,
    });

    expect(result.fileCount).toBe(3);
    expect(mockedFindMany).toHaveBeenCalledTimes(2);
    expect(mockedFindMany.mock.calls[0][0]).not.toHaveProperty("cursor");
    expect(mockedFindMany.mock.calls[1][0]).toMatchObject({ cursor: { id: "res-2" }, skip: 1 });
  });

  test("stops at maxFiles and flags that more exist", async () => {
    respondWithBatches([
      response("res-1", {
        [UPLOAD_ELEMENT_ID]: [
          `/storage/${WORKSPACE_ID}/private/a.jpg`,
          `/storage/${WORKSPACE_ID}/private/b.jpg`,
          `/storage/${WORKSPACE_ID}/private/c.jpg`,
        ],
      }),
    ]);

    const result = await collectResponseAttachments({ survey: buildBlocksSurvey(), maxFiles: 2 });

    expect(result.fileCount).toBe(2);
    expect(result.exceedsMaxFiles).toBe(true);
  });

  test("does not flag an export that lands exactly on the cap", async () => {
    respondWithBatches([
      response("res-1", {
        [UPLOAD_ELEMENT_ID]: [
          `/storage/${WORKSPACE_ID}/private/a.jpg`,
          `/storage/${WORKSPACE_ID}/private/b.jpg`,
        ],
      }),
    ]);

    const result = await collectResponseAttachments({ survey: buildBlocksSurvey(), maxFiles: 2 });

    expect(result.fileCount).toBe(2);
    expect(result.exceedsMaxFiles).toBe(false);
  });

  test("queries nothing when the survey has no file-upload element", async () => {
    const survey = {
      id: "survey-1",
      workspaceId: WORKSPACE_ID,
      questions: [],
      blocks: [
        {
          id: "block-1",
          name: "Block 1",
          elements: [{ id: "el-text", type: "openText", headline: i18n("Hi") }],
        },
      ],
    } as unknown as TSurvey;

    const result = await collectResponseAttachments({ survey, maxFiles: 100 });

    expect(result).toEqual({ entries: [], fileCount: 0, responseCount: 0, exceedsMaxFiles: false });
    expect(mockedFindMany).not.toHaveBeenCalled();
  });
});
