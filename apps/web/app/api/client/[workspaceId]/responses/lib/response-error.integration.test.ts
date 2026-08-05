import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError, UniqueConstraintError } from "@formbricks/types/errors";
import { resetDb } from "@/integration/reset-db";
import { handleClientResponseCreateError } from "./response-error";

/**
 * ENG-2174, against the REAL Prisma 7 + @prisma/adapter-pg stack.
 *
 * The adapter builds the P2002 column list by regex-scraping the Postgres error DETAIL
 * (`Key ("surveyId", "singleUseId")=(…)`) and never unquotes it, so every camelCase column arrives
 * wrapped in double quotes. The exact-equality checks in `response-error.ts` therefore never matched
 * and a routine duplicate submission fell through to `DatabaseError` — a 500, plus a Sentry report,
 * instead of the documented 409.
 *
 * The unit tests could not have caught this: they build the meta by hand, and every fixture in the
 * repo passed unquoted names. Only a genuine violation produces the quoting, so this drives one.
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
    // The premise of the bug: the adapter reports the columns quoted.
    const rawFields = (
      error?.meta as { driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } }
    )?.driverAdapterError?.cause?.constraint?.fields;
    expect(rawFields).toContain('"singleUseId"');

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
    const rawFields = (
      error?.meta as { driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } }
    )?.driverAdapterError?.cause?.constraint?.fields;
    expect(rawFields).toContain('"displayId"');

    expect(() => handleClientResponseCreateError(error, display.id)).toThrow(InvalidInputError);
    expect(() => handleClientResponseCreateError(error, display.id)).not.toThrow(DatabaseError);
  });
});
