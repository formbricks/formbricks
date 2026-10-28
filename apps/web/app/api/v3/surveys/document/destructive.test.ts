import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TV3SurveyDocument } from "../schemas";
import {
  V3SurveyDestructiveChangeError,
  findRemovedBlocksAndElements,
  surveyDestructiveGuard,
} from "./destructive";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { response: { count: vi.fn() } } }));

const block = (id: string, elementIds: string[]) => ({
  id,
  name: id,
  elements: elementIds.map((elementId) => ({ id: elementId })),
});

const current = [block("b1", ["e1", "e2"]), block("b2", ["e3"])];

const run = (next: ReturnType<typeof block>[]) =>
  surveyDestructiveGuard({
    currentSurvey: { id: "survey_1", blocks: current } as unknown as TSurvey,
    document: { blocks: next } as unknown as TV3SurveyDocument,
  });

describe("findRemovedBlocksAndElements", () => {
  test("lists removed blocks and elements, and not an element that moved block", () => {
    expect(
      findRemovedBlocksAndElements(current as never, [block("b1", ["e1", "e3"]), block("b3", [])] as never)
    ).toEqual({ blockIds: ["b2"], elementIds: ["e2"] });
  });

  test("finds nothing when only order, additions or content change", () => {
    expect(
      findRemovedBlocksAndElements(
        current as never,
        [block("b2", ["e3", "new"]), block("b1", ["e2", "e1"])] as never
      )
    ).toEqual({ blockIds: [], elementIds: [] });
  });
});

describe("surveyDestructiveGuard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("asks nothing when nothing is removed", async () => {
    await run([...current, block("b3", ["e4"])]);

    expect(prisma.response.count).not.toHaveBeenCalled();
  });

  test("lets a removal through on a survey without responses", async () => {
    vi.mocked(prisma.response.count).mockResolvedValue(0);

    await expect(run([block("b1", ["e1", "e2"])])).resolves.toBeUndefined();
    expect(prisma.response.count).toHaveBeenCalledWith({ where: { surveyId: "survey_1" } });
  });

  test("refuses a removal on a survey with responses, naming what goes and how many answers there are", async () => {
    vi.mocked(prisma.response.count).mockResolvedValue(12);

    const error = await run([block("b1", ["e1"])]).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(V3SurveyDestructiveChangeError);
    expect((error as V3SurveyDestructiveChangeError).changes).toEqual([
      { type: "blocks_removed", ids: ["b2"], responseCount: 12 },
      { type: "elements_removed", ids: ["e2", "e3"], responseCount: 12 },
    ]);
    expect(prisma.response.count).toHaveBeenCalledTimes(1);
  });
});
