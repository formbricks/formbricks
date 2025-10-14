import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

type I18nString = Record<string, string>;

interface SurveyQuestion {
  type: string;
  html?: I18nString;
  subheader?: I18nString;
  [key: string]: unknown;
}

interface SurveyRecord {
  id: string;
  questions: SurveyQuestion[];
}

const processCtaOrConsentQuestion = (question: SurveyQuestion): boolean => {
  // Only process CTA and Consent questions
  if (question.type !== "cta" && question.type !== "consent") {
    return false;
  }

  // If html field exists, move it to subheader
  if (question.html) {
    question.subheader = question.html;
    // Keep html for backward compatibility during transition
    // Will be removed in schema update
    return true;
  }

  // If html doesn't exist but subheader also doesn't exist, create empty subheader
  if (!question.subheader) {
    question.subheader = { default: "" };
    return true;
  }

  return false;
};

export const moveHtmlToSubheaderForCtaAndConsent: MigrationScript = {
  type: "data",
  id: "htm2sub4ctacnsnt1014",
  name: "20251014110903_move_html_to_subheader_for_cta_and_consent",
  run: async ({ tx }) => {
    // Select all surveys with CTA or Consent questions
    const surveys = await tx.$queryRaw<SurveyRecord[]>`
      SELECT id, questions
      FROM "Survey"
      WHERE questions @> '[{"type": "cta"}]'
         OR questions @> '[{"type": "consent"}]'
    `;

    if (surveys.length === 0) {
      logger.info("No surveys with CTA or Consent questions found");
      return;
    }

    logger.info(`Found ${surveys.length.toString()} surveys with CTA or Consent questions`);

    // Process surveys and collect updates
    const updates: { id: string; questions: SurveyQuestion[] }[] = [];

    for (const survey of surveys) {
      let shouldUpdate = false;

      for (const question of survey.questions) {
        const wasUpdated = processCtaOrConsentQuestion(question);
        if (wasUpdated) shouldUpdate = true;
      }

      if (shouldUpdate) {
        updates.push({ id: survey.id, questions: survey.questions });
      }
    }

    if (updates.length === 0) {
      logger.info("No surveys needed updating");
      return;
    }

    logger.info(`Updating ${updates.length.toString()} surveys`);

    // Execute all updates in a single SQL statement using VALUES
    const valuesList = updates
      .map((update) => `('${update.id}', '${JSON.stringify(update.questions).replace(/'/g, "''")}'::jsonb)`)
      .join(", ");

    const result = await tx.$executeRawUnsafe(`
      UPDATE "Survey" 
      SET questions = v.questions
      FROM (VALUES ${valuesList}) AS v(id, questions)
      WHERE "Survey".id = v.id
    `);

    logger.info(
      `Successfully updated ${result.toString()} surveys - moved html to subheader for CTA and Consent questions`
    );
  },
};
