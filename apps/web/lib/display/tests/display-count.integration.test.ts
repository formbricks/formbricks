import { expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { getDisplayCountBySurveyId } from "../service";

const createDisplayResponse = async (surveyId: string, createdAt: Date): Promise<string> => {
  const display = await prisma.display.create({
    data: { surveyId, createdAt },
    select: { id: true },
  });
  const response = await prisma.response.create({
    data: { surveyId, displayId: display.id },
    select: { id: true },
  });
  return response.id;
};

test("counts displays in a large response selection within the survey and date range", async () => {
  const { id: organizationId } = await prisma.organization.create({
    data: { name: "Filtered display count" },
    select: { id: true },
  });
  try {
    const { id: workspaceId } = await prisma.workspace.create({
      data: { name: "Display count workspace", organizationId },
      select: { id: true },
    });
    const [survey, otherSurvey] = await Promise.all(
      ["Filtered survey", "Other survey"].map((name) =>
        prisma.survey.create({ data: { name, workspaceId }, select: { id: true } })
      )
    );

    const min = new Date("2026-01-02T00:00:00.123Z");
    const max = new Date("2026-01-03T00:00:00.456Z");
    const [atMin, atMax, tooEarly, tooLate, otherSurveyResponse] = await Promise.all([
      createDisplayResponse(survey.id, min),
      createDisplayResponse(survey.id, max),
      createDisplayResponse(survey.id, new Date(min.getTime() - 1)),
      createDisplayResponse(survey.id, new Date(max.getTime() + 1)),
      createDisplayResponse(otherSurvey.id, min),
      createDisplayResponse(survey.id, min),
    ]);
    // The PostgreSQL protocol supports at most 65,535 bind parameters. These IDs need no rows:
    // binding the selection as one parameter per ID already hits the limit.
    const absentIds = Array.from(
      { length: 65_536 },
      (_, index) => `fixture${index.toString(36).padStart(17, "0")}`
    );
    const responseIds = [...absentIds, atMin, atMin, atMax, tooEarly, tooLate, otherSurveyResponse];

    await expect(
      getDisplayCountBySurveyId(survey.id, { createdAt: { min, max }, responseIds })
    ).resolves.toBe(2);
  } finally {
    await prisma.organization.delete({ where: { id: organizationId } });
  }
});
