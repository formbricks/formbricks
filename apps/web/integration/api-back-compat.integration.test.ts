import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { toDesiredEmbeddedFields } from "@formbricks/types/embedded-data-mapping";
import { deriveLegacyEmbeddedData } from "@formbricks/types/embedded-data-resolver";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { patchV3Survey } from "@/app/api/v3/surveys/patch";
import { V3SurveyReferenceValidationError } from "@/app/api/v3/surveys/reference-validation";
import { resetDb } from "@/integration/reset-db";
import { reconcileEmbeddedData } from "@/lib/embedded-data/reconcile";
import { selectSurvey, updateSurvey } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";

/**
 * Management API back-compat for Embedded Data, against real Postgres.
 *
 * Two things only a real database can show, and neither is covered anywhere else:
 *
 * 1. **What v1 and v2 keep serving.** `transformPrismaSurvey` swaps the row relation for
 *    `embeddedFields` and deliberately does NOT touch `hiddenFields` / `variables`, so both legacy
 *    APIs hand back the legacy JSON columns verbatim. Their *shape* therefore cannot regress — what
 *    can is the columns and the rows drifting apart, at which point v1 and v2 describe a survey the
 *    app itself no longer agrees with. Every write path is supposed to move both together in one
 *    transaction; these tests are what makes that a checked property rather than a convention. It is
 *    also the exact guarantee ENG-2404 needs before it can drop the columns.
 *
 * 2. **Which names a write may newly declare (ENG-1839).** The guard is grandfathered, so its
 *    behaviour depends on what the survey already holds — which means a fixture with real stored rows
 *    is the only honest way to test it. The table below is the contract an integrator (and the MCP
 *    `patch_survey` tool, which comes through this same path) actually meets.
 */

/** A variable's storage key is its cuid, so a rename moves the name but never the address. */
const VARIABLE_ID = "clvar123456789012345678902";

const BLOCKS = [
  {
    id: "clbk1234567890123456789013",
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

const seedSurvey = async (legacy?: {
  variables?: unknown[];
  hiddenFields?: { enabled: boolean; fieldIds?: string[] };
}): Promise<TSurvey> => {
  const organization = await prisma.organization.create({ data: { name: "Back-compat Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Back-compat Workspace", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: {
      name: "Back-compat Survey",
      type: "link",
      status: "draft",
      workspaceId: workspace.id,
      blocks: BLOCKS,
      variables: (legacy?.variables ?? []) as never,
      hiddenFields: (legacy?.hiddenFields ?? { enabled: false }) as never,
    },
    select: selectSurvey,
  });

  // Mirror the state every stored survey is in: rows reconciled from the columns it was saved with.
  await prisma.$transaction((tx) =>
    reconcileEmbeddedData(tx, { surveyId: survey.id, workspaceId: workspace.id, patch: survey })
  );

  return transformPrismaSurvey<TSurvey>(survey);
};

/**
 * The survey as `GET /api/v1/management/surveys/{id}` and the v2 equivalent serve it. Both select
 * `hiddenFields` and `variables` (service.ts `selectSurvey`; v2's own
 * `modules/api/v2/management/surveys/types/surveys.ts`) and both hand the survey through
 * `transformPrismaSurvey`, so this is the payload an integration written before V1 parses.
 */
const readAsLegacyApi = async (surveyId: string): Promise<TSurvey> =>
  prisma.survey
    .findUniqueOrThrow({ where: { id: surveyId }, select: selectSurvey })
    .then((survey) => transformPrismaSurvey<TSurvey>(survey));

/** The rows, in the shape `toDesiredEmbeddedFields` produces, so columns and rows can be compared. */
const readRows = async (surveyId: string) =>
  prisma.surveyEmbeddedData
    .findMany({
      where: { surveyId },
      orderBy: [{ order: "asc" }, { storageKey: "asc" }],
      select: {
        storageKey: true,
        embeddedData: { select: { name: true, source: true, dataType: true, defaultValue: true } },
      },
    })
    .then((links) => links.map(({ storageKey, embeddedData }) => ({ storageKey, ...embeddedData })));

/**
 * The assertion that catches drift: what the legacy columns say, turned into rows, must equal the
 * rows actually stored. A write that moved one without the other fails here.
 */
const expectNoDrift = async (surveyId: string) => {
  const served = await readAsLegacyApi(surveyId);
  const fromColumns = toDesiredEmbeddedFields({
    variables: served.variables,
    hiddenFields: served.hiddenFields,
  });

  expect(await readRows(surveyId)).toEqual(fromColumns);
};

/** Runs a patch and reports whether the naming guard refused it, so the table reads as a table. */
const patchOutcome = async (
  survey: TSurvey,
  document: Parameters<typeof patchV3Survey>[1],
  requestId: string
): Promise<"accepted" | { refused: string[] }> => {
  try {
    await patchV3Survey(survey, document, requestId);
    return "accepted";
  } catch (error) {
    if (error instanceof V3SurveyReferenceValidationError) {
      return { refused: error.invalidParams.map((param) => param.code) };
    }
    throw error;
  }
};

beforeEach(async () => {
  await resetDb();
});

describe("what v1 and v2 keep serving for a survey with Embedded Data", () => {
  test("hiddenFields keeps main's { enabled, fieldIds } shape", async () => {
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["plan", "utm_source"] } });

    const served = await readAsLegacyApi(survey.id);

    // Order is part of the contract: it is the export column order and the recall picker order.
    expect(served.hiddenFields).toEqual({ enabled: true, fieldIds: ["plan", "utm_source"] });
  });

  test("variables keep main's array-of-objects shape", async () => {
    const survey = await seedSurvey({
      variables: [{ id: VARIABLE_ID, name: "score", type: "number", value: 7 }],
    });

    const served = await readAsLegacyApi(survey.id);

    expect(served.variables).toEqual([{ id: VARIABLE_ID, name: "score", type: "number", value: 7 }]);
  });

  test("a survey with no Embedded Data still reports hiddenFields rather than omitting it", async () => {
    const survey = await seedSurvey();

    const served = await readAsLegacyApi(survey.id);

    // An absent key breaks a consumer doing `survey.hiddenFields.fieldIds`, which is why this is
    // asserted rather than left to the schema.
    expect(served.hiddenFields).toBeDefined();
    expect(served.hiddenFields.fieldIds ?? []).toEqual([]);
  });

  test("the raw row relation never leaks into the payload", async () => {
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["plan"] } });

    const served = await readAsLegacyApi(survey.id);

    expect(served).not.toHaveProperty("embeddedDataLinks");
  });

  test("what the columns say and what the rows hold agree after a seed", async () => {
    const survey = await seedSurvey({
      variables: [{ id: VARIABLE_ID, name: "score", type: "number", value: 7 }],
      hiddenFields: { enabled: true, fieldIds: ["plan"] },
    });

    await expectNoDrift(survey.id);
  });

  test("a v3 patch moves the columns and the rows together, so v1 never goes stale", async () => {
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["plan"] } });

    await patchV3Survey(
      survey,
      { hiddenFields: { enabled: true, fieldIds: ["plan", "utm_source"] } },
      "req_backcompat_patch_adds"
    );

    const served = await readAsLegacyApi(survey.id);
    expect(served.hiddenFields.fieldIds).toEqual(["plan", "utm_source"]);
    await expectNoDrift(survey.id);
  });

  test("a v3 patch that removes a field drops it from the v1 payload too", async () => {
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["plan", "utm_source"] } });

    await patchV3Survey(
      survey,
      { hiddenFields: { enabled: true, fieldIds: ["plan"] } },
      "req_backcompat_patch_removes"
    );

    const served = await readAsLegacyApi(survey.id);
    expect(served.hiddenFields.fieldIds).toEqual(["plan"]);
    await expectNoDrift(survey.id);
  });

  test("deriving the legacy shape back off the rows reproduces what v1 serves", async () => {
    // The round trip ENG-2404 depends on: once the columns are gone, this derivation is what has to
    // stand in for them, so it must already agree with them today.
    const survey = await seedSurvey({
      variables: [{ id: VARIABLE_ID, name: "score", type: "number", value: 7 }],
      hiddenFields: { enabled: true, fieldIds: ["plan"] },
    });

    const served = await readAsLegacyApi(survey.id);
    const derived = deriveLegacyEmbeddedData({
      variables: served.variables,
      hiddenFields: served.hiddenFields,
    });

    expect(derived.map(({ link }) => link.storageKey)).toEqual([VARIABLE_ID, "plan"]);
  });
});

describe("which names a write may newly declare (ENG-1839)", () => {
  test("a survey that already declares a reserved name keeps patching", async () => {
    // `url` names an auto-captured system field. A survey that predates the rule keeps it, and
    // re-sending it unchanged must never fail — this is the case an integrator hits on every write.
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["url"] } });

    expect(
      await patchOutcome(
        survey,
        { hiddenFields: { enabled: true, fieldIds: ["url"] } },
        "req_backcompat_gf_unchanged"
      )
    ).toBe("accepted");
  });

  test("a grandfathered name survives a patch that adds a conforming field beside it", async () => {
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["url"] } });

    expect(
      await patchOutcome(
        survey,
        { hiddenFields: { enabled: true, fieldIds: ["url", "new_field"] } },
        "req_backcompat_gf_plus_ok"
      )
    ).toBe("accepted");
  });

  test("a NEW camelCase field is refused, even beside a grandfathered one", async () => {
    // The half most likely to surprise a caller: `firstName` is an ordinary name, and the MCP
    // `patch_survey` tool comes through this same path, so an agent naming a field this way gets a
    // 400 where it would have worked before V1.
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["url"] } });

    expect(
      await patchOutcome(
        survey,
        { hiddenFields: { enabled: true, fieldIds: ["url", "firstName"] } },
        "req_backcompat_new_camel"
      )
    ).toEqual({ refused: ["forbidden_identifier"] });
  });

  test("a NEW reserved name is refused", async () => {
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["url"] } });

    expect(
      await patchOutcome(
        survey,
        { hiddenFields: { enabled: true, fieldIds: ["url", "country"] } },
        "req_backcompat_new_reserved"
      )
    ).toEqual({ refused: ["forbidden_identifier"] });
  });

  test("grandfathering is case-insensitive", async () => {
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["URL"] } });

    expect(
      await patchOutcome(
        survey,
        { hiddenFields: { enabled: true, fieldIds: ["url"] } },
        "req_backcompat_gf_case"
      )
    ).toBe("accepted");
  });

  test("removing a grandfathered name spends the reprieve — it cannot be re-added", async () => {
    // The second gotcha, and the one an integration that rebuilds `hiddenFields` across two calls
    // will hit: the removal succeeds, and the re-add is then a new declaration.
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["url"] } });

    expect(
      await patchOutcome(
        survey,
        { hiddenFields: { enabled: true, fieldIds: [] } },
        "req_backcompat_gf_remove"
      )
    ).toBe("accepted");

    const afterRemoval = await readAsLegacyApi(survey.id);

    expect(
      await patchOutcome(
        afterRemoval,
        { hiddenFields: { enabled: true, fieldIds: ["url"] } },
        "req_backcompat_gf_readd"
      )
    ).toEqual({ refused: ["forbidden_identifier"] });
  });

  test("renaming a grandfathered field to a conforming name works", async () => {
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["url"] } });

    expect(
      await patchOutcome(
        survey,
        { hiddenFields: { enabled: true, fieldIds: ["page_url"] } },
        "req_backcompat_gf_rename_ok"
      )
    ).toBe("accepted");
  });

  test("renaming a grandfathered field to another non-conforming name is refused", async () => {
    // So a legacy camelCase name may be kept forever, but the moment it is renamed the new
    // convention becomes mandatory.
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["userRegion"] } });

    expect(
      await patchOutcome(
        survey,
        { hiddenFields: { enabled: true, fieldIds: ["userRegionV2"] } },
        "req_backcompat_gf_rename_bad"
      )
    ).toEqual({ refused: ["forbidden_identifier"] });
  });

  test("a variable may NOT take the name of an existing hidden field", async () => {
    // Refused as `duplicate_identifier`, and NOT by the ENG-1839 guard: a variable is addressed by
    // its cuid and a hidden field by its name, so the two storage keys never collide and the
    // reconcile would accept both. v3's reference validation is what refuses it, because recall and
    // logic address both by name and two entries under one name are ambiguous.
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["plan"] } });

    expect(
      await patchOutcome(
        survey,
        { variables: [{ id: VARIABLE_ID, name: "plan", type: "text", value: "free" }] },
        "req_backcompat_variable_shadows_hidden_field"
      )
    ).toEqual({ refused: ["duplicate_identifier"] });
  });

  test("a survey that already holds the clash cannot be patched at all (pre-existing on main)", async () => {
    // Documents a bug this feature did not introduce, so it is not mistaken for one during release QA.
    //
    // The editor refuses to CREATE such a survey — both cards check the clash, the variables card
    // with its own "conflicts with a hidden field" message (which is why it passes empty id lists to
    // `validateId`: the generic duplicate error would pre-empt the specific one). But surveys holding
    // the clash already exist, and v3 then refuses EVERY patch of one, including a patch that resends
    // neither key: the one below only renames the survey and is still rejected, because reference
    // validation runs over the whole merged document.
    //
    // Pre-existing, not an Embedded Data regression: the editor check and the reference validation
    // are both on `main`, and the epic's only change to `reference-validation.ts` is a comment. As of
    // the September 2026 production copy this affects 46 surveys, 28 of them `inProgress` — names
    // like `first_name`, `brand`, `score`. Its own ticket, not V1 release scope.
    const survey = await seedSurvey({
      variables: [{ id: VARIABLE_ID, name: "plan", type: "text", value: "free" }],
      hiddenFields: { enabled: true, fieldIds: ["plan"] },
    });

    expect(await patchOutcome(survey, { name: "Renamed" }, "req_backcompat_clash_untouched")).toEqual({
      refused: ["duplicate_identifier"],
    });
  });
});

/**
 * The same grandfathering, proven at the v1 / v2 write boundary rather than v3's.
 *
 * `PUT /api/v1/management/surveys/{id}` and the v2 equivalent both land in `updateSurvey`, whose
 * guard (`lib/survey/service.ts`, the `assertNoReservedNewDeclaredFieldNames` call) is a second call
 * site of the same function v3 uses. Shared code is not shared coverage: the two sites build
 * `existing` differently — v3 from the current survey and the patch *document*, this one from the
 * current survey and the *whole* replacement survey — and a PUT replaces rather than merges, so a
 * key the caller omits is a removal here and a no-op there. That difference is exactly what decides
 * whether a legacy integration's every-field PUT keeps working, so it gets its own tests.
 */
const putOutcome = async (
  survey: TSurvey,
  patch: Partial<TSurvey>
): Promise<"accepted" | { refused: string }> => {
  try {
    await updateSurvey({ ...survey, ...patch });
    return "accepted";
  } catch (error) {
    // The guard throws InvalidInputError, which `handleApiError` maps to a 400 for both APIs.
    return { refused: (error as Error).name };
  }
};

describe("grandfathering at the v1 / v2 write boundary (updateSurvey)", () => {
  test("a full PUT that resends a grandfathered reserved name is accepted", async () => {
    // The case every legacy integration hits: read the survey, change something unrelated, PUT it
    // all back. `url` is reserved, and re-sending it must not fail.
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["url"] } });

    expect(await putOutcome(survey, { name: "Renamed via PUT" })).toBe("accepted");

    const served = await readAsLegacyApi(survey.id);
    expect(served.hiddenFields.fieldIds).toEqual(["url"]);
    await expectNoDrift(survey.id);
  });

  test("a PUT that adds a conforming field beside a grandfathered one is accepted", async () => {
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["url"] } });

    expect(
      await putOutcome(survey, { hiddenFields: { enabled: true, fieldIds: ["url", "new_field"] } })
    ).toBe("accepted");
    await expectNoDrift(survey.id);
  });

  test("a PUT that adds a NEW reserved name is refused", async () => {
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["url"] } });

    expect(
      await putOutcome(survey, { hiddenFields: { enabled: true, fieldIds: ["url", "country"] } })
    ).toEqual({ refused: "InvalidInputError" });
  });

  test("a PUT that adds a NEW camelCase field is refused", async () => {
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["url"] } });

    expect(
      await putOutcome(survey, { hiddenFields: { enabled: true, fieldIds: ["url", "firstName"] } })
    ).toEqual({ refused: "InvalidInputError" });
  });

  test("a PUT that omits a grandfathered field removes it, and it cannot be PUT back", async () => {
    // The PUT-specific shape of "removal spends the reprieve": omission is removal on this path,
    // so an integration that rebuilds the field list can lose a reserved name it cannot restore.
    const survey = await seedSurvey({ hiddenFields: { enabled: true, fieldIds: ["url"] } });

    expect(await putOutcome(survey, { hiddenFields: { enabled: true, fieldIds: [] } })).toBe("accepted");

    const afterRemoval = await readAsLegacyApi(survey.id);
    expect(afterRemoval.hiddenFields.fieldIds).toEqual([]);

    expect(await putOutcome(afterRemoval, { hiddenFields: { enabled: true, fieldIds: ["url"] } })).toEqual({
      refused: "InvalidInputError",
    });
  });

  test("a PUT keeps the rows in step, so v1 never serves a stale field list", async () => {
    const survey = await seedSurvey({
      variables: [{ id: VARIABLE_ID, name: "score", type: "number", value: 7 }],
      hiddenFields: { enabled: true, fieldIds: ["plan"] },
    });

    expect(await putOutcome(survey, { hiddenFields: { enabled: true, fieldIds: ["plan", "tier"] } })).toBe(
      "accepted"
    );

    const served = await readAsLegacyApi(survey.id);
    expect(served.hiddenFields.fieldIds).toEqual(["plan", "tier"]);
    expect(served.variables).toHaveLength(1);
    await expectNoDrift(survey.id);
  });
});
