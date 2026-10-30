import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { executeV3SurveyCreate } from "@/app/api/v3/surveys/create";
import { executeV3SurveyPatch } from "@/app/api/v3/surveys/patch";
import { prepareV3SurveyCreate, prepareV3SurveyPatchInput } from "@/app/api/v3/surveys/prepare";
import { ZV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import { resetDb } from "@/integration/reset-db";
import { createSurvey, selectSurveyWithCustomCss } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";
import { runInSurveyWriteTransaction } from "@/lib/survey/write-transaction";

/**
 * Survey writes inside a transaction their caller opened (ENG-6845), against real Postgres.
 *
 * An import creates a survey's references (action classes, attribute keys, languages) and the survey
 * in one transaction, so a failure part-way leaves nothing behind. That only holds if every read and
 * write of the survey operation goes through the caller's transaction — and the work it does after its
 * own commit waits for the caller's — which only a real database can show: the unit suite mocks
 * `@formbricks/database`, so a write that silently used its own connection would pass there.
 */

class OuterRollback extends Error {
  constructor() {
    super("the caller's transaction failed after the survey write");
    this.name = "OuterRollback";
  }
}

const BLOCKS = [
  {
    id: "clbk1234567890123456789099",
    name: "Main Block",
    elements: [
      {
        id: "satisfaction",
        type: "openText",
        headline: { default: "What should we improve?" },
        required: true,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
  },
];

const VARIABLE_ID = "clvar123456789012345678999";

const seedWorkspace = async () => {
  const organization = await prisma.organization.create({ data: { name: "Outer Tx Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Outer Tx Workspace", organizationId: organization.id },
  });
  const user = await prisma.user.create({
    data: { email: `creator-${workspace.id}@example.com`, name: "Creator", emailVerified: true },
  });
  await prisma.membership.create({
    data: { organizationId: organization.id, userId: user.id, role: "owner", accepted: true },
  });
  return { organizationId: organization.id, workspaceId: workspace.id, userId: user.id };
};

/** A Reference the import creates in its transaction before it writes the survey that uses it. */
const createActionClassIn = (tx: Prisma.TransactionClient, workspaceId: string) =>
  tx.actionClass.create({
    data: { name: "Imported action", type: "code", key: "imported-action", workspaceId },
  });

/** The other Reference an import creates: an attribute key its targeting filters name. */
const createAttributeKeyIn = (tx: Prisma.TransactionClient, workspaceId: string) =>
  tx.contactAttributeKey.create({ data: { key: "plan", name: "Plan", workspaceId } });

/** Every row a survey create can leave in the workspace, counted. */
const countWorkspaceRows = async (workspaceId: string) => ({
  surveys: await prisma.survey.count({ where: { workspaceId } }),
  segments: await prisma.segment.count({ where: { workspaceId } }),
  actionClasses: await prisma.actionClass.count({ where: { workspaceId } }),
  embeddedData: await prisma.embeddedData.count({ where: { workspaceId } }),
  languages: await prisma.language.count({ where: { workspaceId } }),
  attributeKeys: await prisma.contactAttributeKey.count({ where: { workspaceId } }),
});

const NOTHING = {
  surveys: 0,
  segments: 0,
  actionClasses: 0,
  embeddedData: 0,
  languages: 0,
  attributeKeys: 0,
};

const readResponseAlerts = async (userId: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { notificationSettings: true },
  });
  return (user.notificationSettings as { alert?: Record<string, boolean> } | null)?.alert ?? {};
};

beforeEach(async () => {
  await resetDb();
});

describe("createSurvey inside a caller's transaction (real Postgres)", () => {
  const createAppSurveyIn = (
    transaction: Parameters<Parameters<typeof runInSurveyWriteTransaction>[0]>[0],
    seed: Awaited<ReturnType<typeof seedWorkspace>>,
    actionClass: Awaited<ReturnType<typeof createActionClassIn>>
  ) =>
    createSurvey(
      seed.workspaceId,
      {
        name: "Imported survey",
        type: "app",
        createdBy: seed.userId,
        blocks: BLOCKS as never,
        variables: [{ id: VARIABLE_ID, name: "score", type: "number", value: 0 }],
        hiddenFields: { enabled: true, fieldIds: ["utm_source"] },
        triggers: [{ actionClass }],
      },
      { creationFacts: { ownerId: seed.userId, visibility: "workspace" }, transaction }
    );

  test("a rollback after the create leaves no survey and no side rows", async () => {
    const seed = await seedWorkspace();

    await expect(
      runInSurveyWriteTransaction(async (transaction) => {
        const actionClass = await createActionClassIn(transaction.tx, seed.workspaceId);
        await createAppSurveyIn(transaction, seed, actionClass);
        throw new OuterRollback();
      })
    ).rejects.toBeInstanceOf(OuterRollback);

    expect(await countWorkspaceRows(seed.workspaceId)).toEqual(NOTHING);
    // The creator's response-alert subscription is post-commit work: after a rollback it never runs.
    expect(await readResponseAlerts(seed.userId)).toEqual({});
  });

  test("a commit keeps the survey with the references it was created against, and only then subscribes the creator", async () => {
    const seed = await seedWorkspace();
    let alertsBeforeCommit: Record<string, boolean> | undefined;

    const created = await runInSurveyWriteTransaction(async (transaction) => {
      const actionClass = await createActionClassIn(transaction.tx, seed.workspaceId);
      const survey = await createAppSurveyIn(transaction, seed, actionClass);
      alertsBeforeCommit = await readResponseAlerts(seed.userId);
      return survey;
    });

    expect(alertsBeforeCommit).toEqual({});
    expect(await readResponseAlerts(seed.userId)).toEqual({ [created.id]: true });

    const stored = await prisma.survey.findUniqueOrThrow({
      where: { id: created.id },
      select: {
        name: true,
        segment: { select: { isPrivate: true, title: true } },
        triggers: { select: { actionClass: { select: { key: true } } } },
        embeddedDataLinks: { select: { storageKey: true }, orderBy: { storageKey: "asc" } },
      },
    });
    expect(stored).toEqual({
      name: "Imported survey",
      segment: { isPrivate: true, title: created.id },
      triggers: [{ actionClass: { key: "imported-action" } }],
      embeddedDataLinks: [{ storageKey: VARIABLE_ID }, { storageKey: "utm_source" }],
    });
  });
});

describe("the v3 create operation inside a caller's transaction (real Postgres)", () => {
  /**
   * An app survey in two languages, with a trigger and a targeting filter that point at References the
   * caller creates in the same transaction. `de-DE` does not exist in the workspace yet, so the
   * operation creates it — one more row that has to roll back with the survey.
   */
  const createV3AppSurveyIn = (
    transaction: Parameters<Parameters<typeof runInSurveyWriteTransaction>[0]>[0],
    workspaceId: string,
    actionClassId: string
  ) => {
    const preparation = prepareV3SurveyCreate(
      ZV3CreateSurveyBody.parse({
        workspaceId,
        name: "Imported v3 survey",
        type: "app",
        defaultLanguage: "en-US",
        languages: [{ code: "de-DE", enabled: true }],
        blocks: [
          {
            id: "clbk1234567890123456789098",
            name: "Main Block",
            elements: [
              {
                id: "feedback",
                type: "openText",
                headline: { "en-US": "How is it going?", "de-DE": "Wie läuft es?" },
                required: false,
              },
            ],
          },
        ],
        variables: [{ id: VARIABLE_ID, name: "score", type: "number", value: 0 }],
        distribution: { displayPercentage: 50, triggers: [{ actionClassId }] },
        targeting: {
          filters: [
            {
              id: "clf01234567890123456789099",
              connector: null,
              resource: {
                id: "clf11234567890123456789099",
                root: { type: "attribute", contactAttributeKey: "plan" },
                qualifier: { operator: "equals" },
                value: "pro",
              },
            },
          ],
        },
      })
    );
    if (!preparation.ok) throw new Error("fixture document failed to prepare");

    return executeV3SurveyCreate({
      input: preparation.document,
      authentication: null,
      languageRequests: preparation.languageRequests,
      requestId: "req_outer_tx_v3_create",
      transaction,
    });
  };

  test("a rollback after the create leaves no survey and no side rows", async () => {
    const seed = await seedWorkspace();

    await expect(
      runInSurveyWriteTransaction(async (transaction) => {
        const actionClass = await createActionClassIn(transaction.tx, seed.workspaceId);
        await createAttributeKeyIn(transaction.tx, seed.workspaceId);
        await createV3AppSurveyIn(transaction, seed.workspaceId, actionClass.id);
        throw new OuterRollback();
      })
    ).rejects.toBeInstanceOf(OuterRollback);

    expect(await countWorkspaceRows(seed.workspaceId)).toEqual(NOTHING);
  });

  test("a commit keeps the survey, its languages and its targeting", async () => {
    const seed = await seedWorkspace();

    const created = await runInSurveyWriteTransaction(async (transaction) => {
      const actionClass = await createActionClassIn(transaction.tx, seed.workspaceId);
      await createAttributeKeyIn(transaction.tx, seed.workspaceId);
      return createV3AppSurveyIn(transaction, seed.workspaceId, actionClass.id);
    });

    // An app survey's result is read back through the caller's transaction — the survey is not
    // committed yet, so no other reader can see it — and comes out the way every later read serves it:
    // the private segment connected, the display percentage a number rather than Prisma's Decimal.
    expect(created.segment?.filters).toHaveLength(1);
    expect(created.displayPercentage).toBe(50);

    const stored = await prisma.survey.findUniqueOrThrow({
      where: { id: created.id },
      select: {
        languages: { select: { language: { select: { code: true } }, default: true } },
        segment: { select: { filters: true } },
        triggers: { select: { actionClass: { select: { key: true } } } },
      },
    });
    expect(
      stored.languages.map(({ language, default: isDefault }) => [language.code, isDefault]).sort()
    ).toEqual([
      ["de-DE", false],
      ["en-US", true],
    ]);
    expect(stored.segment?.filters).toEqual(created.segment?.filters);
    expect(stored.triggers).toEqual([{ actionClass: { key: "imported-action" } }]);
  });
});

describe("the v3 patch operation inside a caller's transaction (real Postgres)", () => {
  /** A committed app survey to patch, created the way any other caller creates one. */
  const seedAppSurvey = async (workspaceId: string): Promise<TSurvey> => {
    const created = await createSurvey(
      workspaceId,
      { name: "Live copy", type: "app", blocks: BLOCKS as never },
      { creationFacts: { ownerId: null, visibility: "workspace" } }
    );
    return loadSurvey(created.id);
  };

  const loadSurvey = async (surveyId: string): Promise<TSurvey> =>
    transformPrismaSurvey<TSurvey>(
      await prisma.survey.findUniqueOrThrow({ where: { id: surveyId }, select: selectSurveyWithCustomCss })
    );

  /**
   * What an Update writes: new content, a new language, a variable, and a distribution and targeting
   * that point at References the caller creates in the same transaction.
   */
  const patchIn = (
    transaction: Parameters<Parameters<typeof runInSurveyWriteTransaction>[0]>[0],
    currentSurvey: TSurvey,
    actionClassId: string
  ) => {
    const preparation = prepareV3SurveyPatchInput(currentSurvey, {
      name: "Updated from the file",
      languages: [{ code: "de-DE", enabled: true }],
      blocks: [
        {
          id: BLOCKS[0].id,
          name: "Main Block",
          elements: [
            {
              id: "satisfaction",
              type: "openText",
              headline: { "en-US": "What should we change?", "de-DE": "Was sollen wir ändern?" },
              required: true,
            },
          ],
        },
      ],
      variables: [{ id: VARIABLE_ID, name: "score", type: "number", value: 0 }],
      distribution: { triggers: [{ actionClassId }] },
      targeting: {
        filters: [
          {
            id: "clf01234567890123456789098",
            connector: null,
            resource: {
              id: "clf11234567890123456789098",
              root: { type: "attribute", contactAttributeKey: "plan" },
              qualifier: { operator: "equals" },
              value: "pro",
            },
          },
        ],
      },
    });
    if (!preparation.ok) {
      throw new Error(`fixture patch failed to prepare: ${JSON.stringify(preparation.validation)}`);
    }

    return executeV3SurveyPatch({
      currentSurvey,
      document: preparation.document,
      languageRequests: preparation.languageRequests,
      requestId: "req_outer_tx_v3_patch",
      replacesDistribution: true,
      transaction,
    });
  };

  test("a rollback after the patch leaves the survey as it was", async () => {
    const seed = await seedWorkspace();
    const survey = await seedAppSurvey(seed.workspaceId);
    const rowsBefore = await countWorkspaceRows(seed.workspaceId);

    await expect(
      runInSurveyWriteTransaction(async (transaction) => {
        const actionClass = await createActionClassIn(transaction.tx, seed.workspaceId);
        await createAttributeKeyIn(transaction.tx, seed.workspaceId);
        await patchIn(transaction, survey, actionClass.id);
        throw new OuterRollback();
      })
    ).rejects.toBeInstanceOf(OuterRollback);

    // The whole survey as every reader sees it — content, languages, segment filters, triggers, the
    // Embedded Data rows and `updatedAt` — is what it was before the patch.
    expect(await loadSurvey(survey.id)).toEqual(survey);
    expect(await countWorkspaceRows(seed.workspaceId)).toEqual(rowsBefore);
  });

  test("a commit applies the patch, References included", async () => {
    const seed = await seedWorkspace();
    const survey = await seedAppSurvey(seed.workspaceId);

    const patched = await runInSurveyWriteTransaction(async (transaction) => {
      const actionClass = await createActionClassIn(transaction.tx, seed.workspaceId);
      await createAttributeKeyIn(transaction.tx, seed.workspaceId);
      return patchIn(transaction, survey, actionClass.id);
    });

    const stored = await loadSurvey(survey.id);
    expect(stored).toEqual(patched);
    expect(stored.name).toBe("Updated from the file");
    expect(stored.languages.map(({ language }) => language.code).sort()).toEqual(["de-DE", "en-US"]);
    expect(stored.triggers.map(({ actionClass }) => actionClass.key)).toEqual(["imported-action"]);
    expect(stored.segment?.filters).toHaveLength(1);
    expect(stored.variables).toEqual([{ id: VARIABLE_ID, name: "score", type: "number", value: 0 }]);
  });
});
