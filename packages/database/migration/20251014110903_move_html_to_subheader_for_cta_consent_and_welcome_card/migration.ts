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
    // Select all surveys that might need migration
    const surveys = await tx.$queryRaw<SurveyRecord[]>`
      SELECT id, questions, "welcomeCard"
      FROM "Survey"
      WHERE questions @> '[{"type": "cta"}]'
         OR questions @> '[{"type": "consent"}]'
         OR "welcomeCard"->>'html' IS NOT NULL
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

    // Execute updates in batches using Promise.all for better performance
    // We use raw queries to avoid breaking migrations in future schema changes
    const BATCH_SIZE = 10000;
    let updatedCount = 0;

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (update) => {
          if (update.questions && update.welcomeCard) {
            await tx.$executeRaw`
              UPDATE "Survey" 
              SET 
                questions = ${JSON.stringify(update.questions)}::jsonb,
                "welcomeCard" = ${JSON.stringify(update.welcomeCard)}::jsonb
              WHERE id = ${update.id}
            `;
          } else if (update.questions) {
            await tx.$executeRaw`
              UPDATE "Survey" 
              SET questions = ${JSON.stringify(update.questions)}::jsonb
              WHERE id = ${update.id}
            `;
          } else if (update.welcomeCard) {
            await tx.$executeRaw`
              UPDATE "Survey" 
              SET "welcomeCard" = ${JSON.stringify(update.welcomeCard)}::jsonb
              WHERE id = ${update.id}
            `;
          }
        })
      );

      updatedCount += batch.length;
      logger.info(`Progress: ${updatedCount.toString()}/${updates.length.toString()} surveys updated`);
    }

    logger.info(
      `Successfully updated ${updatedCount.toString()} surveys - moved html to subheader for CTA/Consent questions and welcome cards`
    );
  },
};
