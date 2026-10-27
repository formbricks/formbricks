import { describe, expect, test, vi } from "vitest";
import { collectResponseFileUrls, getSurveyFileUploadElementIds } from "@/modules/storage/utils";
import { deleteResponsesInTransaction } from "./delete-responses";

vi.mock("@/modules/storage/utils", () => ({
  getSurveyFileUploadElementIds: vi.fn(),
  collectResponseFileUrls: vi.fn(),
}));

const makeTx = (rows: { id: string; displayId: string | null; data: unknown; surveyId: string }[]) => ({
  response: {
    findMany: vi.fn().mockResolvedValue(rows),
    deleteMany: vi.fn().mockResolvedValue({ count: rows.length }),
  },
  survey: {
    findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({ id, blocks: [], questions: [] }))
    ),
  },
  display: { deleteMany: vi.fn() },
});

describe("deleteResponsesInTransaction", () => {
  test("deletes the matched rows and their displays, returning their files per survey", async () => {
    vi.mocked(getSurveyFileUploadElementIds).mockImplementation(() => new Set(["upload"]));
    vi.mocked(collectResponseFileUrls).mockImplementation((_data, _ids, surveyId) => [`file-of-${surveyId}`]);
    const tx = makeTx([
      { id: "r1", displayId: "d1", data: {}, surveyId: "s1" },
      { id: "r2", displayId: null, data: {}, surveyId: "s2" },
      { id: "r3", displayId: "d3", data: {}, surveyId: "s1" },
    ]);
    const where = { survey: { workspaceId: "clwsp" } };

    await expect(deleteResponsesInTransaction(tx as never, where)).resolves.toEqual({
      deleted: 3,
      deletedIds: ["r1", "r2", "r3"],
      bySurvey: [
        { surveyId: "s1", responseIds: ["r1", "r3"], fileUrls: ["file-of-s1", "file-of-s1"] },
        { surveyId: "s2", responseIds: ["r2"], fileUrls: ["file-of-s2"] },
      ],
    });

    // One survey read for all of them, and the delete bound to exactly the rows read.
    expect(tx.survey.findMany).toHaveBeenCalledTimes(1);
    expect(tx.response.deleteMany).toHaveBeenCalledWith({
      where: { AND: [where, { id: { in: ["r1", "r2", "r3"] } }] },
    });
    expect(tx.display.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["d1", "d3"] } } });
  });

  test("touches nothing when no row matches", async () => {
    const tx = makeTx([]);

    await expect(deleteResponsesInTransaction(tx as never, { id: { in: ["gone"] } })).resolves.toEqual({
      deleted: 0,
      deletedIds: [],
      bySurvey: [],
    });
    expect(tx.response.deleteMany).not.toHaveBeenCalled();
    expect(tx.display.deleteMany).not.toHaveBeenCalled();
  });
});
