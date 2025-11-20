import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

// Type definitions for migration
type I18nString = Record<string, string>;

interface SurveyQuestion {
  id: string;
  type: string;
  headline?: I18nString;
  logic?: SurveyLogic[];
  logicFallback?: string;
  buttonLabel?: I18nString;
  backButtonLabel?: I18nString;
  buttonUrl?: string;
  buttonExternal?: boolean;
  dismissButtonLabel?: I18nString;
  ctaButtonLabel?: I18nString;
  [key: string]: unknown;
}

// Single condition type (leaf node)
interface SingleCondition {
  id: string;
  leftOperand: { value: string; type: string; meta?: Record<string, unknown> };
  operator: string;
  rightOperand?: { type: string; value: string | number | string[] };
  connector?: undefined; // Single conditions don't have connectors
}

// Condition group type (has nested conditions)
interface ConditionGroup {
  id: string;
  connector: "and" | "or";
  conditions: Condition[];
}

// Union type for both
type Condition = SingleCondition | ConditionGroup;

// Type guards
const isSingleCondition = (condition: Condition): condition is SingleCondition => {
  return "leftOperand" in condition && "operator" in condition;
};

const isConditionGroup = (condition: Condition): condition is ConditionGroup => {
  return "conditions" in condition && "connector" in condition;
};

interface SurveyLogic {
  id: string;
  conditions: ConditionGroup; // Logic always starts with a condition group
  actions: LogicAction[];
}

interface LogicAction {
  id: string;
  objective: string;
  target?: string;
  [key: string]: unknown;
}

interface Block {
  id: string;
  name: string;
  elements: SurveyQuestion[];
  logic?: SurveyLogic[];
  logicFallback?: string;
  buttonLabel?: I18nString;
  backButtonLabel?: I18nString;
}

interface SurveyRecord {
  id: string;
  questions: SurveyQuestion[];
  blocks?: Block[];
  endings?: { id: string; [key: string]: unknown }[];
}

interface MigratedSurvey {
  id: string;
  blocks: Block[];
  questions: SurveyQuestion[];
}

// Statistics tracking for CTA migration
interface CTAMigrationStats {
  totalCTAElements: number;
  ctaWithExternalLink: number;
  ctaWithoutExternalLink: number;
}

/**
 * Check if a condition references a CTA element with a specific operator
 * Can handle both SingleCondition and ConditionGroup
 */
const conditionReferencesCTA = (
  condition: Condition | null | undefined,
  ctaElementId: string,
  operator?: string
): boolean => {
  if (!condition) return false;

  // Check if it's a single condition
  if (isSingleCondition(condition)) {
    if (condition.leftOperand.value === ctaElementId) {
      if (operator) {
        return condition.operator === operator;
      }
      return true;
    }
    return false;
  }

  // It's a condition group - check nested conditions
  if (isConditionGroup(condition)) {
    return condition.conditions.some((c) => conditionReferencesCTA(c, ctaElementId, operator));
  }

  return false;
};

/**
 * Remove conditions that reference a CTA element with specific operators
 */
const removeCtaConditions = (
  conditionGroup: ConditionGroup,
  ctaElementId: string,
  operatorsToRemove: string[]
): ConditionGroup | null => {
  const filteredConditions = conditionGroup.conditions.filter((condition) => {
    // Check if it's a single condition referencing the CTA
    if (isSingleCondition(condition)) {
      if (condition.leftOperand.value === ctaElementId) {
        return !operatorsToRemove.includes(condition.operator);
      }
      return true;
    }

    // It's a condition group - recurse
    if (isConditionGroup(condition)) {
      const cleaned = removeCtaConditions(condition, ctaElementId, operatorsToRemove);
      if (!cleaned || cleaned.conditions.length === 0) {
        return false;
      }
      // Replace the condition with the cleaned version
      Object.assign(condition, cleaned);
      return true;
    }

    return true;
  });

  if (filteredConditions.length === 0) {
    return null;
  }

  return {
    ...conditionGroup,
    conditions: filteredConditions,
  };
};

/**
 * Migrate a single CTA question: update fields and clean logic
 */
const migrateCTAQuestion = (question: SurveyQuestion, stats: CTAMigrationStats): void => {
  if (question.type !== "cta") return;

  stats.totalCTAElements++;

  // Check if CTA has external link
  const hasExternalButton = question.buttonExternal === true && Boolean(question.buttonUrl);

  if (hasExternalButton) {
    stats.ctaWithExternalLink++;

    // Copy buttonLabel to ctaButtonLabel
    if (question.buttonLabel) {
      question.ctaButtonLabel = question.buttonLabel;
    }

    // Ensure buttonUrl and buttonExternal are set
    question.buttonExternal = true;
  } else {
    stats.ctaWithoutExternalLink++;
    // CTA without external link: remove buttonExternal and buttonUrl
    delete question.buttonExternal;
    delete question.buttonUrl;
  }

  // Remove old fields that are no longer used
  delete question.buttonLabel;
  delete question.dismissButtonLabel;
};

/**
 * Clean CTA logic from a question's logic array
 */
const cleanCTALogicFromQuestion = (question: SurveyQuestion, ctaQuestions: Map<string, boolean>): void => {
  if (!question.logic || question.logic.length === 0) return;

  const cleanedLogic: SurveyLogic[] = [];

  question.logic.forEach((logicRule) => {
    let shouldKeepRule = true;
    let modifiedConditions = logicRule.conditions;

    // Check each CTA question
    ctaQuestions.forEach((hasExternalButton, ctaId) => {
      if (!hasExternalButton) {
        // CTA without external button - remove ALL conditions referencing this CTA
        if (conditionReferencesCTA(modifiedConditions, ctaId)) {
          const cleanedConditions = removeCtaConditions(modifiedConditions, ctaId, [
            "isClicked",
            "isSkipped",
          ]);
          if (!cleanedConditions?.conditions || cleanedConditions.conditions.length === 0) {
            shouldKeepRule = false;
          } else {
            modifiedConditions = cleanedConditions;
          }
        }
      } else if (conditionReferencesCTA(modifiedConditions, ctaId, "isSkipped")) {
        // CTA with external button - remove isSkipped, keep isClicked
        const cleanedConditions = removeCtaConditions(modifiedConditions, ctaId, ["isSkipped"]);
        if (!cleanedConditions?.conditions || cleanedConditions.conditions.length === 0) {
          shouldKeepRule = false;
        } else {
          modifiedConditions = cleanedConditions;
        }
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- shouldKeepRule can be modified in loop
    if (shouldKeepRule) {
      cleanedLogic.push({
        ...logicRule,
        conditions: modifiedConditions,
      });
    }
  });

  if (cleanedLogic.length === 0) {
    delete question.logic;
  } else {
    question.logic = cleanedLogic;
  }
};

/**
 * Process all CTA questions in a survey: migrate fields and clean logic
 */
const processCTAQuestions = (questions: SurveyQuestion[], stats: CTAMigrationStats): void => {
  // Build map of CTA question IDs to their external button status
  const ctaQuestions = new Map<string, boolean>();

  questions.forEach((question) => {
    if (question.type === "cta") {
      const hasExternalButton = question.buttonExternal === true && Boolean(question.buttonUrl);
      ctaQuestions.set(question.id, hasExternalButton);
    }
  });

  if (ctaQuestions.size === 0) return;

  // First pass: migrate CTA question fields
  questions.forEach((question) => {
    migrateCTAQuestion(question, stats);
  });

  // Second pass: clean CTA logic from ALL questions
  questions.forEach((question) => {
    cleanCTALogicFromQuestion(question, ctaQuestions);
  });
};

/**
 * Generate block name from question headline or use index-based fallback
 * @param questionIdx - The 0-based index of the question in the survey
 * @returns Block name (e.g., "Block 1", "Block 2")
 */
const getBlockName = (questionIdx: number): string => {
  return `Block ${String(questionIdx + 1)}`;
};

/**
 * Update logic actions: convert jumpToQuestion to jumpToBlock with new block IDs
 * @param actions - Array of logic actions
 * @param questionIdToBlockId - Map of question IDs to new block IDs
 * @param endingIds - Set of valid ending card IDs
 * @returns Updated actions array with jumpToBlock objectives
 */
const updateLogicActions = (
  actions: LogicAction[],
  questionIdToBlockId: Map<string, string>,
  endingIds: Set<string>
): LogicAction[] => {
  return actions.map((action) => {
    if (action.objective === "jumpToQuestion") {
      const target = action.target ?? "";
      const blockId = questionIdToBlockId.get(target);

      if (blockId) {
        // Target is a question ID - convert to block ID
        return {
          ...action,
          objective: "jumpToBlock",
          target: blockId,
        };
      }

      // Check if target is a valid ending card ID
      if (endingIds.has(target)) {
        // Target is an ending card - keep it as is but change objective
        return {
          ...action,
          objective: "jumpToBlock",
          target,
        };
      }

      // Target is neither a question nor an ending card - keep as is
      return {
        ...action,
        objective: "jumpToBlock",
        target,
      };
    }

    // calculate and requireAnswer stay unchanged
    return action;
  });
};

/**
 * Update logic fallback: convert question ID to block ID
 * @param fallback - The fallback question ID or ending card ID
 * @param questionIdToBlockId - Map of question IDs to new block IDs
 * @param endingIds - Set of valid ending card IDs
 * @returns Updated fallback with block ID, unchanged ending card ID, or undefined if invalid
 */
const updateLogicFallback = (
  fallback: string,
  questionIdToBlockId: Map<string, string>,
  endingIds: Set<string>
): string | undefined => {
  const blockId = questionIdToBlockId.get(fallback);

  if (blockId) {
    // Fallback is a question ID - convert to block ID
    return blockId;
  }

  // Check if fallback is a valid ending card ID
  if (endingIds.has(fallback)) {
    // Fallback is an ending card - keep it as is
    return fallback;
  }

  // Fallback is neither a question nor an ending card - remove it
  return undefined;
};

/**
 * Convert logic operand types from "question" to "element" recursively (immutable)
 * @param condition - Condition or condition group to convert
 * @returns New condition object with "element" type instead of "question"
 */
const convertQuestionToElementType = (condition: Condition | null | undefined): Condition | null => {
  if (!condition) return null;

  // Handle single condition
  if (isSingleCondition(condition)) {
    const newCondition: SingleCondition = { ...condition };

    // Update leftOperand if it's of type "question"
    if (condition.leftOperand.type === "question") {
      newCondition.leftOperand = {
        ...condition.leftOperand,
        type: "element",
      };
    }

    // Update rightOperand if it exists and is of type "question"
    if (condition.rightOperand && condition.rightOperand.type === "question") {
      newCondition.rightOperand = {
        ...condition.rightOperand,
        type: "element",
      };
    }

    return newCondition;
  }

  // Handle condition group
  if (isConditionGroup(condition)) {
    const newConditionGroup: ConditionGroup = {
      ...condition,
      conditions: condition.conditions.map((nestedCondition) => {
        const converted = convertQuestionToElementType(nestedCondition);
        return converted ?? nestedCondition;
      }),
    };

    return newConditionGroup;
  }

  return null;
};

/**
 * Migrate a survey from questions to blocks structure
 * Each question becomes a block with a single element
 * @param survey - Survey record with questions
 * @param createIdFn - Function to generate CUIDs for blocks
 * @param ctaStats - Statistics tracker for CTA migration
 * @returns Migrated survey with blocks and empty questions array
 */
const migrateQuestionsSurveyToBlocks = (
  survey: SurveyRecord,
  createIdFn: () => string,
  ctaStats: CTAMigrationStats
): MigratedSurvey => {
  // Skip if no questions
  if (survey.questions.length === 0) {
    return { ...survey, blocks: survey.blocks ?? [], questions: [] };
  }

  // STEP 1: Process CTA questions FIRST (before converting to blocks)
  processCTAQuestions(survey.questions, ctaStats);

  // Create set of valid ending card IDs for validation
  const endingIds = new Set<string>((survey.endings ?? []).map((ending) => ending.id));

  // Phase 1: Create blocks and ID mapping
  const questionIdToBlockId = new Map<string, string>();
  const blocks: Block[] = [];

  for (let i = 0; i < survey.questions.length; i++) {
    const question = survey.questions[i];

    const blockId = createIdFn();
    questionIdToBlockId.set(question.id, blockId);

    // Extract logic from question level
    const { logic, logicFallback, buttonLabel, backButtonLabel, ...baseElement } = question;

    blocks.push({
      id: blockId,
      name: getBlockName(i),
      elements: [baseElement],
      buttonLabel,
      backButtonLabel,
      logic, // Will update in Phase 2
      logicFallback, // Will update in Phase 2
    });
  }

  // Phase 2: Update all logic references
  for (const block of blocks) {
    if (block.logic && block.logic.length > 0) {
      block.logic = block.logic.map((item) => {
        // Convert "question" type to "element" type in conditions (immutably)
        const updatedConditions = convertQuestionToElementType(item.conditions);

        // Since item.conditions is always a ConditionGroup, the result should be too
        if (!updatedConditions || !isConditionGroup(updatedConditions)) {
          // This should never happen, but if it does, keep the original
          return item;
        }

        return {
          ...item,
          conditions: updatedConditions,
          actions: updateLogicActions(item.actions, questionIdToBlockId, endingIds),
        };
      });
    }

    if (block.logicFallback) {
      block.logicFallback = updateLogicFallback(block.logicFallback, questionIdToBlockId, endingIds);
    }
  }

  return {
    ...survey,
    blocks,
    questions: [],
  };
};

export const migrateQuestionsToBlocks: MigrationScript = {
  type: "data",
  id: "wsm6h7c8jt086g96ob7wda14",
  name: "20251118032116_migrate_questions_to_blocks",
  run: async ({ tx }) => {
    // Initialize CTA statistics tracker
    const ctaStats: CTAMigrationStats = {
      totalCTAElements: 0,
      ctaWithExternalLink: 0,
      ctaWithoutExternalLink: 0,
    };

    // 1. Query surveys with questions (also fetch endings for validation)
    const surveys = await tx.$queryRaw<SurveyRecord[]>`
      SELECT id, questions, blocks, endings
      FROM "Survey"
      WHERE jsonb_array_length(questions) > 0
    `;

    if (surveys.length === 0) {
      logger.info("No surveys found that need migration");
      return;
    }

    logger.info(`Found ${surveys.length.toString()} surveys to migrate`);

    // 2. Process each survey
    const updates: { id: string; blocks: Block[]; questions: SurveyQuestion[] }[] = [];
    let failedCount = 0;

    for (const survey of surveys) {
      try {
        const migrated = migrateQuestionsSurveyToBlocks(survey, createId, ctaStats);
        updates.push({
          id: migrated.id,
          blocks: migrated.blocks,
          questions: [],
        });
      } catch (error) {
        failedCount++;
        logger.error(error, `Failed to migrate survey ${survey.id}`);
      }
    }

    if (updates.length === 0) {
      logger.error(`All ${failedCount.toString()} surveys failed migration`);
      throw new Error("Migration failed for all surveys");
    }

    logger.info(
      `Successfully processed ${updates.length.toString()} surveys, ${failedCount.toString()} failed`
    );

    // 3. Update surveys individually for safety (avoids SQL injection risks with complex JSONB arrays)
    let updatedCount = 0;

    for (const update of updates) {
      try {
        // PostgreSQL requires proper array format for jsonb[]
        // We need to convert the JSON array to a PostgreSQL jsonb array using array_to_json
        // The trick is to use jsonb_array_elements to convert the JSON array into rows, then array_agg to collect them back
        await tx.$executeRawUnsafe(
          `UPDATE "Survey" 
           SET blocks = (
             SELECT array_agg(elem)
             FROM jsonb_array_elements($1::jsonb) AS elem
           ), 
           questions = $2::jsonb 
           WHERE id = $3`,
          JSON.stringify(update.blocks),
          JSON.stringify(update.questions),
          update.id
        );

        updatedCount++;

        // Log progress every 10000 surveys
        if (updatedCount % 10000 === 0) {
          logger.info(`Progress: ${updatedCount.toString()}/${updates.length.toString()} surveys updated`);
        }
      } catch (error) {
        logger.error(error, `Failed to update survey ${update.id} in database`);
        failedCount++;
      }
    }

    logger.info(`Migration complete: ${updatedCount.toString()} surveys migrated to blocks`);

    if (failedCount > 0) {
      logger.warn(`Warning: ${failedCount.toString()} surveys failed and need manual review`);
    }

    // 4. Log CTA migration statistics
    if (ctaStats.totalCTAElements > 0) {
      logger.info(
        `CTA elements processed: ${ctaStats.totalCTAElements.toString()} total (${ctaStats.ctaWithExternalLink.toString()} with external link, ${ctaStats.ctaWithoutExternalLink.toString()} without)`
      );
    }

    logger.info("Migration completed successfully");
  },
};
