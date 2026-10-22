import { describe, expect, test, vi } from "vitest";
import { LINKED_CREATIVES_READ_LIMIT, MAX_UNLINK_PAGES, unlinkSurveyCreatives } from "./linked-creatives";

vi.mock("server-only", () => ({}));

const surveyId = "clsv1234567890123456789012";
const workspaceId = "clws1234567890123456789012";

/** A survey with `count` linked creatives; each unlink takes its page off the next read. */
const surveyWithLinkedCreatives = (count: number) => {
  let linked = Array.from({ length: count }, (_, index) => ({ id: `creative-${index}`, name: `C ${index}` }));
  const creative = {
    findMany: vi.fn(async ({ take }: { take: number }) => linked.slice(0, take)),
    updateMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => {
      const unlinkedIds = new Set(where.id.in);
      linked = linked.filter(({ id }) => !unlinkedIds.has(id));
      return { count: where.id.in.length };
    }),
  };
  return { creative } as unknown as Parameters<typeof unlinkSurveyCreatives>[0];
};

describe("unlinkSurveyCreatives", () => {
  test("unlinks every creative of a survey at the ceiling, page by page", async () => {
    const atCeiling = MAX_UNLINK_PAGES * LINKED_CREATIVES_READ_LIMIT;

    const unlinked = await unlinkSurveyCreatives(surveyWithLinkedCreatives(atCeiling), {
      surveyId,
      workspaceId,
      include: "all",
    });

    expect(unlinked).toHaveLength(atCeiling);
  });

  test("throws rather than stop short on a survey past the ceiling", async () => {
    const tx = surveyWithLinkedCreatives(MAX_UNLINK_PAGES * LINKED_CREATIVES_READ_LIMIT + 1);

    await expect(unlinkSurveyCreatives(tx, { surveyId, workspaceId, include: "all" })).rejects.toThrow(
      "creatives to unlink"
    );
    expect(tx.creative.updateMany).toHaveBeenCalledTimes(MAX_UNLINK_PAGES);
  });
});
