import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { loadTestRunResponse } from "./test-run-response";

vi.mock("server-only", () => ({}));

const workspaceId = "cm9zr4mps000008l8btfy1vtz";
const surveyId = "cm9zr4q7i000108l84gozfggr";
const responseId = "cm9zr5res000000000000000a";
const input = { workspaceId, surveyId, responseId };

const isSurveyHidden = vi.fn();

beforeEach(() => {
  isSurveyHidden.mockResolvedValue(false);
});

describe("loadTestRunResponse", () => {
  test("looks the response up only within the trigger's survey, and the survey only within the workspace", async () => {
    prisma.response.findFirst.mockResolvedValue({
      id: responseId,
      surveyId,
      endingId: "cm9zr4end000008l8btfy1vtz",
      data: { nps: 9 },
    } as never);

    const response = await loadTestRunResponse(input, isSurveyHidden);

    expect(prisma.response.findFirst).toHaveBeenCalledWith({
      where: { id: responseId, surveyId, survey: { id: surveyId, workspaceId } },
      select: { id: true, surveyId: true, endingId: true, data: true },
    });
    expect(response).toEqual({
      id: responseId,
      surveyId,
      endingId: "cm9zr4end000008l8btfy1vtz",
      data: { nps: 9 },
    });
  });

  test("answers null for a response outside that survey or workspace", async () => {
    prisma.response.findFirst.mockResolvedValue(null);

    expect(await loadTestRunResponse(input, isSurveyHidden)).toBeNull();
  });

  test("answers null for a survey the caller may not read, without reading the response", async () => {
    isSurveyHidden.mockResolvedValue(true);

    expect(await loadTestRunResponse(input, isSurveyHidden)).toBeNull();
    expect(isSurveyHidden).toHaveBeenCalledWith({ workspaceId, surveyId });
    expect(prisma.response.findFirst).not.toHaveBeenCalled();
  });

  test("hands the runner an object even when the stored data is not one", async () => {
    prisma.response.findFirst.mockResolvedValue({
      id: responseId,
      surveyId,
      endingId: null,
      data: null,
    } as never);

    expect((await loadTestRunResponse(input, isSurveyHidden))?.data).toEqual({});
  });
});
