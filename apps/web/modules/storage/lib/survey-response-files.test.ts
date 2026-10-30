import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getSurvey } from "@/lib/survey/service";
import { collectSurveyResponseFileUrls } from "./survey-response-files";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("@formbricks/database", () => ({ prisma: { response: { findMany: vi.fn() } } }));
vi.mock("@/lib/survey/service", () => ({ getSurvey: vi.fn() }));
vi.mock("@/modules/storage/lib/delete-response-files", () => ({ deleteResponseFileUrls: vi.fn() }));

const SURVEY_ID = "svy_1";
const WORKSPACE_ID = "ws_1";
const scoped = (elementId: string, fileName: string) =>
  `/storage/${WORKSPACE_ID}/private/surveys/${SURVEY_ID}/elements/${elementId}/${fileName}`;

const surveyWith = (elements: { id: string; type: string }[]) =>
  ({
    id: SURVEY_ID,
    workspaceId: WORKSPACE_ID,
    questions: [],
    blocks: [{ id: "blk", name: "Block", elements }],
  }) as never;

const respondWith = (data: Record<string, unknown>) => {
  vi.mocked(prisma.response.findMany)
    .mockReset()
    .mockResolvedValueOnce([{ id: "r1", createdAt: new Date(0), data }] as never)
    .mockResolvedValue([] as never);
};

describe("collectSurveyResponseFileUrls with a Signature element", () => {
  const signatureUrl = scoped("sig", "signature--fid--abc.png");
  const flatUploadUrl = `/storage/${WORKSPACE_ID}/private/photo--fid--abc.png`;

  beforeEach(() => vi.clearAllMocks());

  test("collects a Signature URL on a full scan", async () => {
    vi.mocked(getSurvey).mockResolvedValue(surveyWith([{ id: "sig", type: "signature" }]));
    respondWith({ sig: signatureUrl });

    await expect(collectSurveyResponseFileUrls(SURVEY_ID)).resolves.toEqual({
      fileUrls: [signatureUrl],
      workspaceId: WORKSPACE_ID,
    });
  });

  test("collects the signature left by a removed element on a full scan", async () => {
    const orphan = scoped("removed", "signature--fid--abc.png");
    vi.mocked(getSurvey).mockResolvedValue(surveyWith([{ id: "text", type: "openText" }]));
    respondWith({ removed: orphan, text: scoped("text", "pasted--fid--abc.png") });

    const { fileUrls } = await collectSurveyResponseFileUrls(SURVEY_ID);

    expect(fileUrls).toEqual([orphan]);
  });

  // The survey-delete folder sweep already removes every scoped key, so a flat-keys-only scan must not
  // return a Signature's scoped URL, and with no File upload element it must not read responses at all.
  test("flatKeysOnly never returns a Signature URL and skips the scan when only a Signature exists", async () => {
    vi.mocked(getSurvey).mockResolvedValue(surveyWith([{ id: "sig", type: "signature" }]));
    respondWith({ sig: signatureUrl });

    await expect(collectSurveyResponseFileUrls(SURVEY_ID, { flatKeysOnly: true })).resolves.toEqual({
      fileUrls: [],
      workspaceId: WORKSPACE_ID,
    });
    expect(prisma.response.findMany).not.toHaveBeenCalled();
  });

  test("flatKeysOnly still returns a File upload's flat key next to a Signature, and not the Signature URL", async () => {
    vi.mocked(getSurvey).mockResolvedValue(
      surveyWith([
        { id: "sig", type: "signature" },
        { id: "upload", type: "fileUpload" },
      ])
    );
    respondWith({ sig: signatureUrl, upload: [flatUploadUrl] });

    const { fileUrls } = await collectSurveyResponseFileUrls(SURVEY_ID, { flatKeysOnly: true });

    expect(fileUrls).toEqual([flatUploadUrl]);
  });
});
