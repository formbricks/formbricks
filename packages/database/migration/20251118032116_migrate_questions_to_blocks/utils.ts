import {
  type Block,
  type CTAMigrationStats,
  type Condition,
  type ConditionGroup,
  type IntegrationConfig,
  type LogicAction,
  type MigratedSurvey,
  type NotionConfig,
  type SingleCondition,
  type SurveyLogic,
  type SurveyQuestion,
  type SurveyRecord,
  isConditionGroup as checkIsConditionGroup,
  isSingleCondition as checkIsSingleCondition,
} from "./types";

/**
 * Check if a condition references a CTA element with a specific operator
 * Can handle both SingleCondition and ConditionGroup
 */
export const conditionReferencesCTA = (
  condition: Condition | null | undefined,
  ctaElementId: string,
  operator?: string
): boolean => {
  if (!condition) return false;

  // Check if it's a single condition
  if (checkIsSingleCondition(condition)) {
    if (condition.leftOperand.value === ctaElementId) {
      if (operator) {
        return condition.operator === operator;
      }
      return true;
    }
    return false;
  }

  // It's a condition group - check nested conditions
  if (checkIsConditionGroup(condition)) {
    return condition.conditions.some((c) => conditionReferencesCTA(c, ctaElementId, operator));
  }

  return false;
};

/**
 * Remove conditions that reference a CTA element with specific operators
 */
export const removeCtaConditions = (
  conditionGroup: ConditionGroup,
  ctaElementId: string,
  operatorsToRemove: string[]
): ConditionGroup | null => {
  const filteredConditions = conditionGroup.conditions.filter((condition) => {
    // Check if it's a single condition referencing the CTA
    if (checkIsSingleCondition(condition)) {
      if (condition.leftOperand.value === ctaElementId) {
        return !operatorsToRemove.includes(condition.operator);
      }
      return true;
    }

    // It's a condition group - recurse
    if (checkIsConditionGroup(condition)) {
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
export const migrateCTAQuestion = (question: SurveyQuestion, stats: CTAMigrationStats): void => {
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
export const cleanCTALogicFromQuestion = (
  question: SurveyQuestion,
  ctaQuestions: Map<string, boolean>
): void => {
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
export const processCTAQuestions = (questions: SurveyQuestion[], stats: CTAMigrationStats): void => {
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
export const getBlockName = (questionIdx: number): string => {
  return `Block ${String(questionIdx + 1)}`;
};

/**
 * Update logic actions: convert jumpToQuestion to jumpToBlock with new block IDs
 * @param actions - Array of logic actions
 * @param questionIdToBlockId - Map of question IDs to new block IDs
 * @param endingIds - Set of valid ending card IDs
 * @returns Updated actions array with jumpToBlock objectives
 */
export const updateLogicActions = (
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
export const updateLogicFallback = (
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
export const convertQuestionToElementType = (condition: Condition | null | undefined): Condition | null => {
  if (!condition) return null;

  // Handle single condition
  if (checkIsSingleCondition(condition)) {
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
  if (checkIsConditionGroup(condition)) {
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
export const migrateQuestionsSurveyToBlocks = (
  survey: SurveyRecord,
  createIdFn: () => string,
  ctaStats: CTAMigrationStats
): MigratedSurvey => {
  // Skip if no questions
  if (survey.questions.length === 0) {
    return { id: survey.id, blocks: survey.blocks ?? [] };
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
        if (!updatedConditions || !checkIsConditionGroup(updatedConditions)) {
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
    id: survey.id,
    blocks,
  };
};

// Type guard for config items with data array
interface ConfigWithData {
  data: Record<string, unknown>[];
  [key: string]: unknown;
}

const hasDataArray = (config: unknown): config is ConfigWithData => {
  return (
    typeof config === "object" &&
    config !== null &&
    "data" in config &&
    Array.isArray((config as ConfigWithData).data)
  );
};

/**
 * Check if config item is already migrated (has elementIds/elements)
 */
const isAlreadyMigrated = (item: Record<string, unknown>): boolean => {
  return "elementIds" in item || "elements" in item;
};

/**
 * Check if config item needs migration (has questionIds/questions)
 */
const needsMigration = (item: Record<string, unknown>): boolean => {
  return "questionIds" in item || "questions" in item;
};

/**
 * Migrate Airtable/Google Sheets/Slack config (shared base type)
 * Returns an object with migrated flag and updated config
 */
export const migrateSharedIntegrationConfig = (
  config: IntegrationConfig
): { migrated: boolean; config: IntegrationConfig } => {
  // Validate config structure
  if (!hasDataArray(config)) {
    return { migrated: false, config };
  }

  let anyMigrated = false;

  const newData = config.data.map((item) => {
    // Skip if already migrated
    if (isAlreadyMigrated(item)) {
      return item;
    }

    // Skip if nothing to migrate
    if (!needsMigration(item)) {
      return item;
    }

    anyMigrated = true;
    const migrated: Record<string, unknown> = { ...item };

    // Rename questionIds to elementIds
    if ("questionIds" in migrated) {
      migrated.elementIds = migrated.questionIds;
      delete migrated.questionIds;
    }

    // Rename questions to elements
    if ("questions" in migrated) {
      migrated.elements = migrated.questions;
      delete migrated.questions;
    }

    // All other fields (includeVariables, etc.) are preserved automatically via spread

    return migrated;
  });

  return {
    migrated: anyMigrated,
    config: { ...config, data: newData },
  };
};

// Type guard for Notion config
const isNotionConfig = (config: unknown): config is NotionConfig => {
  return (
    typeof config === "object" &&
    config !== null &&
    "data" in config &&
    Array.isArray((config as NotionConfig).data)
  );
};

// Type for Notion mapping entry
interface NotionMappingEntry {
  question?: { id: string; name: string; type: string };
  element?: { id: string; name: string; type: string };
  column: { id: string; name: string; type: string };
}

/**
 * Check if Notion config item has any mapping entries that need migration
 * @param mapping - Notion mapping entries
 * @returns boolean
 */
const needsNotionMigration = (mapping: NotionMappingEntry[] | undefined): boolean => {
  if (!mapping || !Array.isArray(mapping) || mapping.length === 0) {
    return false;
  }

  // Check if ANY mapping item has "question" field (needs migration)
  return mapping.some((mapItem) => "question" in mapItem && !("element" in mapItem));
};

/**
 * Migrate Notion config (custom mapping structure)
 * @param config - Notion config
 * @returns \{ migrated: boolean; config: IntegrationConfig \}
 */
export const migrateNotionIntegrationConfig = (
  config: IntegrationConfig
): { migrated: boolean; config: IntegrationConfig } => {
  // Validate config structure
  if (!isNotionConfig(config)) {
    return { migrated: false, config };
  }

  let anyMigrated = false;

  const newData = config.data.map((item) => {
    // Cast mapping to the migration type that includes both old and new formats
    const mapping = item.mapping as NotionMappingEntry[] | undefined;

    // Skip if nothing to migrate
    if (!needsNotionMigration(mapping)) {
      return item;
    }

    anyMigrated = true;

    // Migrate mapping array - check EACH item individually
    const newMapping = mapping?.map((mapItem) => {
      // Already has element field - skip this item
      if ("element" in mapItem) {
        return mapItem;
      }

      // Has question field - migrate it
      if ("question" in mapItem) {
        const { question, ...rest } = mapItem;
        return {
          ...rest,
          element: question,
        };
      }

      // Neither element nor question - return as is
      return mapItem;
    });

    return {
      ...item,
      mapping: newMapping,
    };
  });

  return {
    migrated: anyMigrated,
    config: { ...config, data: newData },
  };
};

/**
 * Migrate integration config based on type
 * @param type - Integration type
 * @param config - Integration config
 * @returns \{ migrated: boolean; config: IntegrationConfig \}
 */
export const migrateIntegrationConfig = (
  type: string,
  config: IntegrationConfig
): { migrated: boolean; config: IntegrationConfig } => {
  switch (type) {
    case "googleSheets":
    case "airtable":
    case "slack":
      return migrateSharedIntegrationConfig(config);
    case "notion":
      return migrateNotionIntegrationConfig(config);
    case "n8n":
      // n8n has no config schema to migrate
      return { migrated: false, config };
    default:
      // Unknown type - return unchanged
      return { migrated: false, config };
  }
};
