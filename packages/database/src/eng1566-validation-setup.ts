/**
 * TEMPORARY local harness — validates backfill-canonical-choice-labels.ts end to end.
 *
 * Creates in the local app DB:
 *   - languages de + fr on the target workspace
 *   - a trilingual survey (default en) with: single select (incl. "other" +
 *     "None of the above"), multi select (incl. "other"), matrix, ranking
 *   - a formbricks_survey FeedbackSource + one mapping per element
 *
 * Inserts into the local hub DB "legacy" feedback_records that replicate the
 * PRE-#8441 ingestion output (localized value_text), plus control rows that the
 * backfill must NOT touch (canonical en rows, other free-text, edited labels,
 * a CSV-source row, ranking value_number rows).
 *
 * Run:   dotenv -e ../../.env -- tsx src/eng1566-validation-setup.ts
 * Clean: dotenv -e ../../.env -- tsx src/eng1566-validation-setup.ts --clean
 */
import { createId } from "@paralleldrive/cuid2";
import { Client } from "pg";
import { PrismaClient } from "./prisma";
import { createPrismaPgAdapter } from "./prisma-adapter";

const WORKSPACE_ID = "cmr06jznc0008lusgka1oqfy0"; // "lololo"
const DIRECTORY_ID = "cmr09b5va00004psgehmoqpfc"; // FeedbackDirectory "test" == hub tenant_id
const SURVEY_NAME = "ENG-1566 Backfill Validation Survey";
const SOURCE_NAME = "ENG-1566 Backfill Validation Source";

// Stable element ids so hub rows and assertions line up.
export const IDS = {
  survey: "eng1566validationsurvey00",
  singleSelect: "eng1566single00000000000",
  multiSelect: "eng1566multi000000000000",
  matrix: "eng1566matrix00000000000",
  ranking: "eng1566ranking0000000000",
  matrixRowSpeed: "eng1566mrowspeed",
  matrixRowPrice: "eng1566mrowprice",
};

const i18n = (en: string, de: string, fr: string) => ({ default: en, "de-DE": de, "fr-FR": fr });

const BLOCKS = [
  {
    id: createId(),
    name: "Block 1",
    elements: [
      {
        id: IDS.singleSelect,
        type: "multipleChoiceSingle",
        headline: i18n("What is your gender?", "Was ist dein Geschlecht?", "Quel est votre genre ?"),
        required: false,
        choices: [
          { id: "c-male", label: i18n("Male", "Männlich", "Homme") },
          { id: "c-female", label: i18n("Female", "Weiblich", "Femme") },
          { id: "c-none", label: i18n("None of the above", "Keine der genannten", "Aucune de ces réponses") },
          { id: "other", label: i18n("Other", "Andere", "Autre") },
        ],
        otherOptionPlaceholder: i18n("Please specify", "Bitte angeben", "Veuillez préciser"),
      },
      {
        id: IDS.multiSelect,
        type: "multipleChoiceMulti",
        headline: i18n(
          "Which colors do you like?",
          "Welche Farben magst du?",
          "Quelles couleurs aimez-vous ?"
        ),
        required: false,
        choices: [
          { id: "c-red", label: i18n("Red", "Rot", "Rouge") },
          { id: "c-blue", label: i18n("Blue", "Blau", "Bleu") },
          { id: "c-green", label: i18n("Green", "Grün", "Vert") },
          { id: "other", label: i18n("Other", "Andere", "Autre") },
        ],
        otherOptionPlaceholder: i18n("Please specify", "Bitte angeben", "Veuillez préciser"),
      },
      {
        id: IDS.matrix,
        type: "matrix",
        headline: i18n("Rate our service", "Bewerte unseren Service", "Évaluez notre service"),
        required: false,
        rows: [
          { id: IDS.matrixRowSpeed, label: i18n("Speed", "Geschwindigkeit", "Vitesse") },
          { id: IDS.matrixRowPrice, label: i18n("Price", "Preis", "Prix") },
        ],
        columns: [
          { id: "col-good", label: i18n("Good", "Gut", "Bon") },
          { id: "col-okay", label: i18n("Okay", "Okay", "Moyen") },
          { id: "col-bad", label: i18n("Bad", "Schlecht", "Mauvais") },
        ],
      },
      {
        id: IDS.ranking,
        type: "ranking",
        headline: i18n("Rank these features", "Ordne diese Funktionen", "Classez ces fonctionnalités"),
        required: false,
        choices: [
          { id: "r-speed", label: i18n("Speed", "Geschwindigkeit", "Vitesse") },
          { id: "r-design", label: i18n("Design", "Design", "Design") },
        ],
      },
    ],
  },
];

interface LegacyRow {
  fieldId: string;
  fieldType: string;
  fieldLabel: string;
  fieldGroupId?: string;
  fieldGroupLabel?: string;
  valueText?: string;
  valueNumber?: number;
  language?: string; // omitted == default-language response (ingestion omits it)
  sourceType?: string; // default formbricks_survey
  note: string; // what this row validates
}

// Legacy rows exactly as PRE-#8441 ingestion would have written them.
const LEGACY_ROWS: LegacyRow[] = [
  // --- single select: canonical en rows (language omitted) — MUST stay unchanged
  {
    fieldId: IDS.singleSelect,
    fieldType: "categorical",
    fieldLabel: "What is your gender?",
    valueText: "Male",
    note: "en canonical (control)",
  },
  {
    fieldId: IDS.singleSelect,
    fieldType: "categorical",
    fieldLabel: "What is your gender?",
    valueText: "Female",
    note: "en canonical (control)",
  },
  // --- single select: localized rows — MUST be rewritten to canonical
  {
    fieldId: IDS.singleSelect,
    fieldType: "categorical",
    fieldLabel: "What is your gender?",
    valueText: "Männlich",
    language: "de-DE",
    note: "de localized → Male",
  },
  {
    fieldId: IDS.singleSelect,
    fieldType: "categorical",
    fieldLabel: "What is your gender?",
    valueText: "Männlich",
    language: "de-DE",
    note: "de localized → Male (2nd row, same value)",
  },
  {
    fieldId: IDS.singleSelect,
    fieldType: "categorical",
    fieldLabel: "What is your gender?",
    valueText: "Weiblich",
    language: "de-DE",
    note: "de localized → Female",
  },
  {
    fieldId: IDS.singleSelect,
    fieldType: "categorical",
    fieldLabel: "What is your gender?",
    valueText: "Femme",
    language: "fr-FR",
    note: "fr localized → Female",
  },
  {
    fieldId: IDS.singleSelect,
    fieldType: "categorical",
    fieldLabel: "What is your gender?",
    valueText: "Keine der genannten",
    language: "de-DE",
    note: "de none-of-the-above → None of the above",
  },
  // --- single select: "other" free text — MUST stay unchanged
  {
    fieldId: IDS.singleSelect,
    fieldType: "categorical",
    fieldLabel: "What is your gender?",
    valueText: "nicht binär",
    language: "de-DE",
    note: "other free-text (control)",
  },
  // --- single select: label edited since submission — MUST stay unchanged
  {
    fieldId: IDS.singleSelect,
    fieldType: "categorical",
    fieldLabel: "What is your gender?",
    valueText: "Alte Option",
    language: "de-DE",
    note: "edited/stale label (control)",
  },
  // --- multi select: localized joined strings
  {
    fieldId: IDS.multiSelect,
    fieldType: "categorical",
    fieldLabel: "Which colors do you like?",
    valueText: "Rot, Blau",
    language: "de-DE",
    note: "de joined → Red, Blue",
  },
  {
    fieldId: IDS.multiSelect,
    fieldType: "categorical",
    fieldLabel: "Which colors do you like?",
    valueText: "Grün",
    language: "de-DE",
    note: "de single → Green",
  },
  {
    fieldId: IDS.multiSelect,
    fieldType: "categorical",
    fieldLabel: "Which colors do you like?",
    valueText: "Rouge, Vert",
    language: "fr-FR",
    note: "fr joined → Red, Green",
  },
  // --- multi select: choice + other free text (comma inside other text)
  {
    fieldId: IDS.multiSelect,
    fieldType: "categorical",
    fieldLabel: "Which colors do you like?",
    valueText: "Blau, türkis, fast grün",
    language: "de-DE",
    note: "de choice + comma-y other → Blue, türkis, fast grün",
  },
  {
    fieldId: IDS.multiSelect,
    fieldType: "categorical",
    fieldLabel: "Which colors do you like?",
    valueText: "Red, Blue",
    note: "en canonical joined (control)",
  },
  // --- matrix: legacy field_id = elementId__rowId, localized COLUMN values
  {
    fieldId: `${IDS.matrix}__${IDS.matrixRowSpeed}`,
    fieldType: "categorical",
    fieldLabel: "Speed",
    fieldGroupId: IDS.matrix,
    fieldGroupLabel: "Rate our service",
    valueText: "Gut",
    language: "de-DE",
    note: "de matrix column → Good",
  },
  {
    fieldId: `${IDS.matrix}__${IDS.matrixRowPrice}`,
    fieldType: "categorical",
    fieldLabel: "Price",
    fieldGroupId: IDS.matrix,
    fieldGroupLabel: "Rate our service",
    valueText: "Schlecht",
    language: "de-DE",
    note: "de matrix column → Bad",
  },
  {
    fieldId: `${IDS.matrix}__${IDS.matrixRowSpeed}`,
    fieldType: "categorical",
    fieldLabel: "Speed",
    fieldGroupId: IDS.matrix,
    fieldGroupLabel: "Rate our service",
    valueText: "Moyen",
    language: "fr-FR",
    note: "fr matrix column → Okay",
  },
  {
    fieldId: `${IDS.matrix}__${IDS.matrixRowSpeed}`,
    fieldType: "categorical",
    fieldLabel: "Speed",
    fieldGroupId: IDS.matrix,
    fieldGroupLabel: "Rate our service",
    valueText: "Good",
    note: "en matrix canonical (control)",
  },
  // --- ranking: value_number only, field_label already canonical — MUST stay unchanged
  {
    fieldId: `${IDS.ranking}__r-speed`,
    fieldType: "number",
    fieldLabel: "Speed",
    fieldGroupId: IDS.ranking,
    fieldGroupLabel: "Rank these features",
    valueNumber: 1,
    language: "de-DE",
    note: "ranking (control, no value_text)",
  },
  {
    fieldId: `${IDS.ranking}__r-design`,
    fieldType: "number",
    fieldLabel: "Design",
    fieldGroupId: IDS.ranking,
    fieldGroupLabel: "Rank these features",
    valueNumber: 2,
    language: "de-DE",
    note: "ranking (control, no value_text)",
  },
  // --- CSV-source row that coincidentally matches a localized label — MUST stay unchanged
  {
    fieldId: IDS.singleSelect,
    fieldType: "categorical",
    fieldLabel: "What is your gender?",
    valueText: "Männlich",
    language: "de-DE",
    sourceType: "csv",
    note: "csv source (control)",
  },
];

const main = async (): Promise<void> => {
  const clean = process.argv.includes("--clean");
  const prisma = new PrismaClient({ adapter: createPrismaPgAdapter().adapter });
  const hub = new Client({
    connectionString: process.env.HUB_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/hub",
  });
  await hub.connect();

  try {
    if (clean) {
      await hub.query(`DELETE FROM feedback_records WHERE submission_id LIKE 'eng1566-legacy-%'`);
      await prisma.feedbackSource.deleteMany({ where: { workspaceId: WORKSPACE_ID, name: SOURCE_NAME } });
      await prisma.survey.deleteMany({ where: { id: IDS.survey } });
      console.log("Cleaned validation survey, source and hub rows.");
      return;
    }

    // 1) languages de + fr on the workspace
    const languageIds: Record<string, string> = {};
    for (const code of ["de-DE", "fr-FR"]) {
      const language = await prisma.language.upsert({
        where: { workspaceId_code: { workspaceId: WORKSPACE_ID, code } },
        create: { workspaceId: WORKSPACE_ID, code },
        update: {},
      });
      languageIds[code] = language.id;
    }

    // 2) trilingual survey
    await prisma.survey.upsert({
      where: { id: IDS.survey },
      create: {
        id: IDS.survey,
        name: SURVEY_NAME,
        workspaceId: WORKSPACE_ID,
        status: "inProgress",
        blocks: BLOCKS,
        languages: {
          create: [
            { languageId: languageIds["de-DE"], default: false, enabled: true },
            { languageId: languageIds["fr-FR"], default: false, enabled: true },
          ],
        },
      },
      update: { blocks: BLOCKS },
    });

    // NOTE: default language rides on the survey's base i18n "default" key; no
    // SurveyLanguage row needed for it (matches how the app models languages).

    // 3) feedback source + one mapping per element
    const source = await prisma.feedbackSource.upsert({
      where: { workspaceId_name: { workspaceId: WORKSPACE_ID, name: SOURCE_NAME } },
      create: {
        name: SOURCE_NAME,
        type: "formbricks_survey",
        workspaceId: WORKSPACE_ID,
        feedbackDirectoryId: DIRECTORY_ID,
      },
      update: {},
    });

    const mappingTargets = [
      { elementId: IDS.singleSelect, hubFieldType: "categorical" },
      { elementId: IDS.multiSelect, hubFieldType: "categorical" },
      { elementId: IDS.matrix, hubFieldType: "categorical" },
      { elementId: IDS.ranking, hubFieldType: "number" },
    ] as const;

    for (const target of mappingTargets) {
      await prisma.feedbackSourceFormbricksMapping.upsert({
        where: {
          workspaceId_feedbackSourceId_surveyId_elementId: {
            workspaceId: WORKSPACE_ID,
            feedbackSourceId: source.id,
            surveyId: IDS.survey,
            elementId: target.elementId,
          },
        },
        create: {
          workspaceId: WORKSPACE_ID,
          feedbackSourceId: source.id,
          surveyId: IDS.survey,
          elementId: target.elementId,
          hubFieldType: target.hubFieldType,
        },
        update: {},
      });
    }

    // 4) legacy hub rows (idempotent: wipe ours first)
    await hub.query(`DELETE FROM feedback_records WHERE submission_id LIKE 'eng1566-legacy-%'`);
    let i = 0;
    for (const row of LEGACY_ROWS) {
      await hub.query(
        `INSERT INTO feedback_records
           (collected_at, source_type, source_id, source_name, field_id, field_label, field_type,
            field_group_id, field_group_label, value_text, value_number, language, tenant_id, submission_id)
         VALUES (now() - ($1 || ' days')::interval, $2, $3, $4, $5, $6, $7::field_type_enum,
                 $8, $9, $10, $11, $12, $13, $14)`,
        [
          i,
          row.sourceType ?? "formbricks_survey",
          IDS.survey,
          SURVEY_NAME,
          row.fieldId,
          row.fieldLabel,
          row.fieldType,
          row.fieldGroupId ?? null,
          row.fieldGroupLabel ?? null,
          row.valueText ?? null,
          row.valueNumber ?? null,
          row.language ?? null,
          DIRECTORY_ID,
          `eng1566-legacy-${i}`,
        ]
      );
      i++;
    }

    console.log(
      `Setup complete: survey ${IDS.survey}, source ${source.id}, ${String(LEGACY_ROWS.length)} legacy hub rows.`
    );
  } finally {
    await hub.end();
    await prisma.$disconnect();
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
