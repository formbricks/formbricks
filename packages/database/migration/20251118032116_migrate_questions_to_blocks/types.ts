export type I18nString = Record<string, string>;

export interface SurveyQuestion {
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
export interface SingleCondition {
  id: string;
  leftOperand: { value: string; type: string; meta?: Record<string, unknown> };
  operator: string;
  rightOperand?: { type: string; value: string | number | string[] };
  connector?: undefined; // Single conditions don't have connectors
}

// Condition group type (has nested conditions)
export interface ConditionGroup {
  id: string;
  connector: "and" | "or";
  conditions: Condition[];
}

// Union type for both
export type Condition = SingleCondition | ConditionGroup;

export interface SurveyLogic {
  id: string;
  conditions: ConditionGroup; // Logic always starts with a condition group
  actions: LogicAction[];
}

export interface LogicAction {
  id: string;
  objective: string;
  target?: string;
  [key: string]: unknown;
}

export interface Block {
  id: string;
  name: string;
  elements: SurveyQuestion[];
  logic?: SurveyLogic[];
  logicFallback?: string;
  buttonLabel?: I18nString;
  backButtonLabel?: I18nString;
}

export interface SurveyRecord {
  id: string;
  questions: SurveyQuestion[];
  blocks?: Block[];
  endings?: { id: string; [key: string]: unknown }[];
}

export interface MigratedSurvey {
  id: string;
  blocks: Block[];
}

// Statistics tracking for CTA migration
export interface CTAMigrationStats {
  totalCTAElements: number;
  ctaWithExternalLink: number;
  ctaWithoutExternalLink: number;
}

// Integration migration types
export interface IntegrationRecord {
  id: string;
  type: string;
  config: any;
}

export interface MigratedIntegration {
  id: string;
  config: any;
}

export interface IntegrationMigrationStats {
  totalIntegrations: number;
  googleSheets: { processed: number; skipped: number };
  airtable: { processed: number; skipped: number };
  slack: { processed: number; skipped: number };
  notion: { processed: number; skipped: number };
  n8n: { skipped: number };
  errors: number;
}

// Type guards
export const isSingleCondition = (condition: Condition): condition is SingleCondition => {
  return "leftOperand" in condition && "operator" in condition;
};

export const isConditionGroup = (condition: Condition): condition is ConditionGroup => {
  return "conditions" in condition && "connector" in condition;
};
