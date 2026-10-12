import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError, UniqueConstraintError } from "@formbricks/types/errors";
import { resetDb } from "@/integration/reset-db";
import { handleClientResponseCreateError } from "./response-error";

/**
 * ENG-2174, against the REAL Prisma 7 + @prisma/adapter-pg stack.
 *
 * Before 7.10 the adapter built the P2002 column list by regex-scraping the Postgres error DETAIL
 * (`Key ("surveyId", "singleUseId")=(…)`) and never unquoted it, so every camelCase column arrived
 * wrapped in double quotes; since 7.10 it reports only the constraint name (ENG-3285). Either way the
 * exact-equality checks in `response-error.ts` stop matching whenever the shape moves, and a routine
 * duplicate submission falls through to `DatabaseError` — a 500, plus a Sentry report, instead of the
 * documented 409.
 *
 * The unit tests cannot catch this: they build the meta by hand. Only a genuine violation produces the
 * real shape, so this drives one. The raw shape itself is pinned in `prisma-constraint.integration.test.ts`;
 * this file asserts only the classification.
 */
beforeEach(async () => {
  await resetDb();
});

const createSurvey = async () => {
  const organization = await prisma.organization.create({ data: { name: "ENG-2174 Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "ENG-2174 Workspace", organizationId: organization.id },
  });
  return prisma.survey.create({ data: { name: "ENG-2174 Survey", workspaceId: workspace.id } });
};

describe("handleClientResponseCreateError vs real Prisma 7 + adapter-pg (ENG-2174)", () => {
  test("maps a duplicate (surveyId, singleUseId) to a 409, not a 500", async () => {
    const survey = await createSurvey();
    const singleUseId = "eng2174-single-use";
    await prisma.response.create({ data: { surveyId: survey.id, singleUseId, data: {} } });

    const error = await prisma.response
      .create({ data: { surveyId: survey.id, singleUseId, data: {} } })
      .catch((e) => e);

    expect(error?.code).toBe("P2002");

    expect(() => handleClientResponseCreateError(error)).toThrow(UniqueConstraintError);
    expect(() => handleClientResponseCreateError(error)).toThrow(
      "Response already submitted for this single-use link"
    );
    // Guards the actual regression: before the fix this fell through to DatabaseError (500).
    expect(() => handleClientResponseCreateError(error)).not.toThrow(DatabaseError);
  });

  test("maps a duplicate displayId to a 400, not a 500", async () => {
    const survey = await createSurvey();
    const display = await prisma.display.create({ data: { surveyId: survey.id } });
    await prisma.response.create({ data: { surveyId: survey.id, displayId: display.id, data: {} } });

    const error = await prisma.response
      .create({ data: { surveyId: survey.id, displayId: display.id, data: {} } })
      .catch((e) => e);

    expect(error?.code).toBe("P2002");

    expect(() => handleClientResponseCreateError(error, display.id)).toThrow(InvalidInputError);
    expect(() => handleClientResponseCreateError(error, display.id)).not.toThrow(DatabaseError);
  });
});
