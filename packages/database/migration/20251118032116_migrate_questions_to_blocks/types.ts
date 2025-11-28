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

// Base integration config data (shared between all integrations except Notion)
// This represents both old (questionIds/questions) and new (elementIds/elements) formats
export interface IntegrationBaseSurveyData {
  createdAt: Date;
  surveyId: string;
  surveyName: string;
  // Old format fields
  questionIds?: string[];
  questions?: string;
  // New format fields
  elementIds?: string[];
  elements?: string;
  // Optional fields
  includeVariables?: boolean;
  includeHiddenFields?: boolean;
  includeMetadata?: boolean;
  includeCreatedAt?: boolean;
}

// Google Sheets specific config
export interface GoogleSheetsConfigData extends IntegrationBaseSurveyData {
  spreadsheetId: string;
  spreadsheetName: string;
}

export interface GoogleSheetsConfig {
  key: {
    token_type: "Bearer";
    access_token: string;
    scope: string;
    expiry_date: number;
    refresh_token: string;
  };
  data: GoogleSheetsConfigData[];
  email: string;
}

// Airtable specific config
export interface AirtableConfigData extends IntegrationBaseSurveyData {
  tableId: string;
  baseId: string;
  tableName: string;
}

export interface AirtableConfig {
  key: {
    expiry_date: string;
    access_token: string;
    refresh_token: string;
  };
  data: AirtableConfigData[];
  email: string;
}

// Slack specific config
export interface SlackConfigData extends IntegrationBaseSurveyData {
  channelId: string;
  channelName: string;
}

export interface SlackConfig {
  key: {
    app_id: string;
    authed_user: { id: string };
    token_type: "bot";
    access_token: string;
    bot_user_id: string;
    team: { id: string; name: string };
  };
  data: SlackConfigData[];
}

// Notion specific config (different structure - uses mapping instead of elementIds/elements)
export interface NotionMappingItem {
  // Old format
  question?: { id: string; name: string; type: string };
  // New format
  element?: { id: string; name: string; type: string };
  column: { id: string; name: string; type: string };
}

export interface NotionConfigData {
  createdAt: Date;
  surveyId: string;
  surveyName: string;
  mapping: NotionMappingItem[];
  databaseId: string;
  databaseName: string;
}

export interface NotionConfig {
  key: {
    access_token: string;
    bot_id: string;
    token_type: string;
    duplicated_template_id: string | null;
    owner: {
      type: string;
      workspace?: boolean | null;
      user: {
        id: string;
        name?: string | null;
        type?: string | null;
        object: string;
        person?: { email: string } | null;
        avatar_url?: string | null;
      } | null;
    };
    workspace_icon: string | null;
    workspace_id: string;
    workspace_name: string | null;
  };
  data: NotionConfigData[];
}

// Union type for all integration configs
export type IntegrationConfig =
  | GoogleSheetsConfig
  | AirtableConfig
  | SlackConfig
  | NotionConfig
  | Record<string, unknown>;

// Integration migration types
export interface IntegrationRecord {
  id: string;
  type: string;
  config: IntegrationConfig;
}

export interface MigratedIntegration {
  id: string;
  config: IntegrationConfig;
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
