import { Prisma } from "@prisma/client";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

type I18nString = Record<string, string>;

interface SurveyQuestion {
  type: string;
  html?: I18nString;
  subheader?: I18nString;
  [key: string]: unknown;
}

interface WelcomeCard {
  html?: I18nString;
  subheader?: I18nString;
  [key: string]: unknown;
}

interface SurveyRecord {
  id: string;
  questions: SurveyQuestion[];
  welcomeCard?: WelcomeCard;
}

const processCtaOrConsentQuestion = (question: SurveyQuestion): boolean => {
  // Only process CTA and Consent questions
  if (question.type !== "cta" && question.type !== "consent") {
    return false;
  }

  // If html field exists, move it to subheader
  if (question.html) {
    question.subheader = question.html;
    delete question.html; // Remove the old html field
    return true;
  }

  return false;
};

const processWelcomeCard = (welcomeCard: WelcomeCard): boolean => {
  // If html field exists, move it to subheader for consistency with ending cards
  if (welcomeCard.html) {
    welcomeCard.subheader = welcomeCard.html;
    delete welcomeCard.html; // Remove the old html field
    return true;
  }

  return false;
};

export const moveHtmlToSubheaderForCtaAndConsent: MigrationScript = {
  type: "data",
  id: "htm2sub4ctacnsnt1014",
  name: "20251014110903_move_html_to_subheader_for_cta_consent_and_welcome_card",
  run: async ({ tx }) => {
    // Select only surveys that actually have html fields to migrate
    // Check for CTA/Consent questions with html field, or welcomeCard with html field
    const surveys = await tx.$queryRaw<SurveyRecord[]>`
      SELECT id, questions, "welcomeCard"
      FROM "Survey"
      WHERE (
        -- Check if any question has type cta/consent AND has html field
        EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(questions) AS q
          WHERE (q->>'type' = 'cta' OR q->>'type' = 'consent')
            AND q->'html' IS NOT NULL
            AND jsonb_typeof(q->'html') = 'object'
        )
        -- Or welcomeCard has html field
        OR (
          "welcomeCard" IS NOT NULL 
          AND "welcomeCard"->'html' IS NOT NULL
          AND jsonb_typeof("welcomeCard"->'html') = 'object'
        )
      )
    `;

    if (surveys.length === 0) {
      logger.info("No surveys found that need migration");
      return;
    }

    logger.info(`Found ${surveys.length.toString()} surveys to process`);

    // Process surveys and collect updates
    const updates: { id: string; questions?: SurveyQuestion[]; welcomeCard?: WelcomeCard }[] = [];

    for (const survey of surveys) {
      let questionsUpdated = false;
      let welcomeCardUpdated = false;

      // Process questions
      for (const question of survey.questions) {
        const wasUpdated = processCtaOrConsentQuestion(question);
        if (wasUpdated) questionsUpdated = true;
      }

      // Process welcome card
      if (survey.welcomeCard && typeof survey.welcomeCard === "object") {
        welcomeCardUpdated = processWelcomeCard(survey.welcomeCard);
      }

      if (questionsUpdated || welcomeCardUpdated) {
        const update: { id: string; questions?: SurveyQuestion[]; welcomeCard?: WelcomeCard } = {
          id: survey.id,
        };
        if (questionsUpdated) update.questions = survey.questions;
        if (welcomeCardUpdated) update.welcomeCard = survey.welcomeCard;
        updates.push(update);
      }
    }

    if (updates.length === 0) {
      logger.info("No surveys needed updating");
      return;
    }

    logger.info(`Updating ${updates.length.toString()} surveys`);

    // Execute updates in batches using bulk UPDATE with VALUES
    // This is much faster than individual updates (1 query per batch instead of N queries)
    const BATCH_SIZE = 10000;
    let updatedCount = 0;

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);

      // Build parameterized VALUES list using Prisma.sql
      const valuesTuples = batch.map((update) => {
        const questionsJson = update.questions ? JSON.stringify(update.questions) : null;
        const welcomeCardJson = update.welcomeCard ? JSON.stringify(update.welcomeCard) : null;

        return Prisma.sql`(${update.id}, ${questionsJson}::jsonb, ${welcomeCardJson}::jsonb)`;
      });

      // Join all tuples into a single VALUES clause
      const valuesClause = Prisma.join(valuesTuples, ", ");

      // Execute single bulk UPDATE query
      await tx.$executeRaw`
        UPDATE "Survey" AS s
        SET 
          questions = COALESCE(v.questions, s.questions),
          "welcomeCard" = COALESCE(v."welcomeCard", s."welcomeCard")
        FROM (VALUES ${valuesClause}) AS v(id, questions, "welcomeCard")
        WHERE s.id = v.id::text
      `;

      updatedCount += batch.length;
      logger.info(`Progress: ${updatedCount.toString()}/${updates.length.toString()} surveys updated`);
    }

    logger.info(
      `Successfully updated ${updatedCount.toString()} surveys - moved html to subheader for CTA/Consent questions and welcome cards`
    );
  },
};
