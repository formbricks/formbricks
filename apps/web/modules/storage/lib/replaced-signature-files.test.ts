import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { enqueueResponseFilesDeletionCleanup } from "@/modules/deletion-cleanup/lib/enqueue";
import { enqueueReplacedSignatureFileCleanup } from "./replaced-signature-files";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/modules/deletion-cleanup/lib/enqueue", () => ({ enqueueResponseFilesDeletionCleanup: vi.fn() }));
// The real collection rules run: only the `server-only` marked config reads are stubbed.
vi.mock("@/lib/constants", () => ({ WEBAPP_URL: "https://app.example.com" }));
vi.mock("@/lib/getPublicUrl", () => ({ getPublicDomain: () => "https://app.example.com" }));

const SURVEY_ID = "svy_1";
const WORKSPACE_ID = "ws_1";
const image = (name: string, elementId = "sig", surveyId = SURVEY_ID) =>
  `/storage/${WORKSPACE_ID}/private/surveys/${surveyId}/elements/${elementId}/${name}`;
const oldImage = image("signature--fid--old.png");
const newImage = image("signature--fid--new.png");

const surveyRow = (elements: { id: string; type: string }[]) => ({
  id: SURVEY_ID,
  workspaceId: WORKSPACE_ID,
  questions: [],
  blocks: [{ id: "blk", name: "Block", elements }],
  workspace: { organizationId: "org_1" },
});

const makeTx = (survey: unknown) => ({ survey: { findUnique: vi.fn().mockResolvedValue(survey) } });
const run = (tx: ReturnType<typeof makeTx>, previousData: unknown, nextData: unknown, bestEffort = false) =>
  enqueueReplacedSignatureFileCleanup(
    tx as never,
    { surveyId: SURVEY_ID, previousData, nextData },
    { bestEffort }
  );

describe("enqueueReplacedSignatureFileCleanup", () => {
  beforeEach(() => vi.clearAllMocks());

  test("queues the old image of a replaced Signature, scoped to the survey's own workspace and organisation", async () => {
    const tx = makeTx(surveyRow([{ id: "sig", type: "signature" }]));

    await run(tx, { sig: oldImage }, { sig: newImage });

    expect(tx.survey.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: SURVEY_ID } }));
    expect(enqueueResponseFilesDeletionCleanup).toHaveBeenCalledExactlyOnceWith(tx, {
      organizationId: "org_1",
      workspaceId: WORKSPACE_ID,
      surveyId: SURVEY_ID,
      fileUrls: [oldImage],
    });
  });

  test("queues the old image of a cleared Signature", async () => {
    const tx = makeTx(surveyRow([{ id: "sig", type: "signature" }]));

    await run(tx, { sig: oldImage }, { sig: "" });

    expect(enqueueResponseFilesDeletionCleanup).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ fileUrls: [oldImage] })
    );
  });

  test("queues nothing for an unchanged Signature, without reading the survey", async () => {
    const tx = makeTx(surveyRow([{ id: "sig", type: "signature" }]));

    await run(tx, { sig: oldImage }, { sig: oldImage });

    expect(tx.survey.findUnique).not.toHaveBeenCalled();
    expect(enqueueResponseFilesDeletionCleanup).not.toHaveBeenCalled();
  });

  test("does not read the survey for an update that changes only ordinary answers", async () => {
    const tx = makeTx(surveyRow([{ id: "text", type: "openText" }]));

    await run(tx, { text: "before", n: 1 }, { text: "after", n: 2 });

    expect(tx.survey.findUnique).not.toHaveBeenCalled();
    expect(enqueueResponseFilesDeletionCleanup).not.toHaveBeenCalled();
  });

  // Signature-only: the same replaced string under a File upload id or a text id is not touched.
  test.each([
    ["a File upload element", "fileUpload"],
    ["a Free text element", "openText"],
  ])("queues nothing when the id is %s", async (_label, type) => {
    const tx = makeTx(surveyRow([{ id: "sig", type }]));

    await run(tx, { sig: oldImage }, { sig: "" });

    expect(enqueueResponseFilesDeletionCleanup).not.toHaveBeenCalled();
  });

  // Key scope: the old value must name this survey and this element, so a write can't delete a file
  // of another survey, another element or another response's element by planting its URL.
  test.each([
    ["another survey's", image("signature--fid--x.png", "sig", "svy_2")],
    ["another element's", image("signature--fid--x.png", "other")],
    ["a flat key", `/storage/${WORKSPACE_ID}/private/signature--fid--x.png`],
  ])("queues nothing when the old value is %s file", async (_label, url) => {
    const tx = makeTx(surveyRow([{ id: "sig", type: "signature" }]));

    await run(tx, { sig: url }, { sig: "" });

    expect(enqueueResponseFilesDeletionCleanup).not.toHaveBeenCalled();
  });

  test("queues nothing when the survey is gone", async () => {
    await run(makeTx(null), { sig: oldImage }, { sig: "" });

    expect(enqueueResponseFilesDeletionCleanup).not.toHaveBeenCalled();
  });

  test("logs a count, never a URL", async () => {
    await run(makeTx(surveyRow([{ id: "sig", type: "signature" }])), { sig: oldImage }, { sig: "" });

    expect(logger.info).toHaveBeenCalledWith(
      { surveyId: SURVEY_ID, fileCount: 1 },
      expect.stringContaining("signature")
    );
    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain("old.png");
  });

  test("lets a queueing failure through inside a transaction", async () => {
    vi.mocked(enqueueResponseFilesDeletionCleanup).mockRejectedValueOnce(new Error("insert failed"));
    const tx = makeTx(surveyRow([{ id: "sig", type: "signature" }]));

    await expect(run(tx, { sig: oldImage }, { sig: "" })).rejects.toThrow("insert failed");
  });

  test("swallows a queueing failure for a write that has already committed, logging no URL", async () => {
    vi.mocked(enqueueResponseFilesDeletionCleanup).mockRejectedValueOnce(new Error("insert failed"));
    const tx = makeTx(surveyRow([{ id: "sig", type: "signature" }]));

    await expect(run(tx, { sig: oldImage }, { sig: "" }, true)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ surveyId: SURVEY_ID }),
      expect.any(String)
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("old.png");
  });
});
