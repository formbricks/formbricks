import { Prisma } from "@prisma/client";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";
import { type SurveyRecord } from "./types";

export const removeEmptyImageAndVideoUrlsFromElements: MigrationScript = {
  type: "data",
  id: "ohw7fb1f64yfh2vax294agp0",
  name: "20251208033316_remove_empty_image_and_video_urls_from_elements",
  run: async ({ tx }) => {
    // Find all surveys with empty imageUrl or videoUrl
    const surveysFindQuery = `
      SELECT s.id, s.blocks, s."welcomeCard", s.endings
      FROM "Survey" AS s 
      WHERE EXISTS (
        SELECT 1 
        FROM unnest(s.blocks) AS block 
        CROSS JOIN jsonb_array_elements(block->'elements') AS element 
        WHERE element->>'imageUrl' = '' 
          OR element->>'videoUrl' = ''
      ) OR s."welcomeCard"->>'fileUrl' = '' 
          OR s."welcomeCard"->>'videoUrl' = ''
      OR EXISTS (
        SELECT 1 
        FROM unnest(s.endings) AS ending 
        WHERE ending->>'imageUrl' = '' 
          OR ending->>'videoUrl' = ''
      )
    `;
    const surveysWithEmptyUrls: SurveyRecord[] = await tx.$queryRaw`${Prisma.raw(surveysFindQuery)}`;

    logger.info(`Found ${surveysWithEmptyUrls.length.toString()} surveys with empty imageUrl or videoUrl`);

    // Process in batches to avoid overwhelming the connection pool
    const BATCH_SIZE = 1000;

    for (let i = 0; i < surveysWithEmptyUrls.length; i += BATCH_SIZE) {
      const batch = surveysWithEmptyUrls.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map((survey) => {
        // Clean the blocks
        const cleanedBlocks = survey.blocks.map((block) => {
          const cleanedElements = block.elements.map((element) => {
            const cleanedElement = { ...element };
            if (cleanedElement.imageUrl === "") {
              delete cleanedElement.imageUrl;
            }
            if (cleanedElement.videoUrl === "") {
              delete cleanedElement.videoUrl;
            }
            return cleanedElement;
          });

          return { ...block, elements: cleanedElements };
        });

        const cleanedWelcomeCard = { ...survey.welcomeCard };
        if (cleanedWelcomeCard.fileUrl === "") {
          delete cleanedWelcomeCard.fileUrl;
        }
        if (cleanedWelcomeCard.videoUrl === "") {
          delete cleanedWelcomeCard.videoUrl;
        }

        const cleanedEndings = survey.endings.map((ending) => {
          const cleanedEnding = { ...ending };
          if (cleanedEnding.imageUrl === "") {
            delete cleanedEnding.imageUrl;
          }
          if (cleanedEnding.videoUrl === "") {
            delete cleanedEnding.videoUrl;
          }
          return cleanedEnding;
        });

        // Convert JSON arrays to PostgreSQL jsonb[] using array_agg + jsonb_array_elements
        const blocksJson = JSON.stringify(cleanedBlocks);
        const endingsJson = JSON.stringify(cleanedEndings);
        const welcomeCardJson = JSON.stringify(cleanedWelcomeCard);

        return tx.$executeRaw`
          UPDATE "Survey"
          SET 
            blocks = (SELECT array_agg(elem) FROM jsonb_array_elements(${blocksJson}::jsonb) AS elem),
            endings = (SELECT array_agg(elem) FROM jsonb_array_elements(${endingsJson}::jsonb) AS elem),
            "welcomeCard" = ${welcomeCardJson}::jsonb
          WHERE id = ${survey.id}
        `;
      });

      await Promise.all(batchPromises);
      logger.info(
        `Processed batch ${(Math.floor(i / BATCH_SIZE) + 1).toString()}/${Math.ceil(surveysWithEmptyUrls.length / BATCH_SIZE).toString()}`
      );
    }

    logger.info(`Successfully cleaned ${surveysWithEmptyUrls.length.toString()} surveys`);
  },
};
