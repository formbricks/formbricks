import { Prisma } from "@prisma/client";
import type { MigrationScript } from "../../src/scripts/migration-runner";
import { type SurveyRecord } from "./types";

export const removeEmptyImageAndVideoUrlsFromElements: MigrationScript = {
  type: "data",
  id: "ohw7fb1f64yfh2vax294agp0",
  name: "20251208033316_remove_empty_image_and_video_urls_from_elements",
  run: async ({ tx }) => {
    // Find all surveys with empty imageUrl or videoUrl
    const countQuery = `
      SELECT s.*
      FROM "Survey" AS s 
      WHERE EXISTS (
        SELECT 1 
        FROM unnest(s.blocks) AS block 
        CROSS JOIN jsonb_array_elements(block->'elements') AS element 
        WHERE element->>'imageUrl' = '' 
          OR element->>'videoUrl' = ''
      )
    `;
    const surveysWithEmptyUrls: SurveyRecord[] = await tx.$queryRaw`${Prisma.raw(countQuery)}`;

    console.log(`Found ${surveysWithEmptyUrls.length.toString()} surveys with empty imageUrl or videoUrl`);

    // Process each survey
    for (const survey of surveysWithEmptyUrls) {
      // Clean the blocks
      const cleanedBlocks = survey.blocks.map((block) => {
        // Clean elements within each block
        const cleanedElements = block.elements.map((element) => {
          const cleanedElement = { ...element };

          // Remove imageUrl if it's empty
          if (cleanedElement.imageUrl === "") {
            delete cleanedElement.imageUrl;
          }

          // Remove videoUrl if it's empty
          if (cleanedElement.videoUrl === "") {
            delete cleanedElement.videoUrl;
          }

          return cleanedElement;
        });

        return {
          ...block,
          elements: cleanedElements,
        };
      });

      // Update the survey with cleaned blocks
      // Convert JSON array to PostgreSQL jsonb[] using array_agg + jsonb_array_elements
      const blocksJson = JSON.stringify(cleanedBlocks);
      await tx.$executeRaw`
        UPDATE "Survey"
        SET blocks = (SELECT array_agg(elem) FROM jsonb_array_elements(${blocksJson}::jsonb) AS elem)
        WHERE id = ${survey.id}
      `;
    }

    console.log(`Successfully cleaned ${surveysWithEmptyUrls.length.toString()} surveys`);
  },
};
