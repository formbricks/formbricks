/**
 * Types for the storage URL migration
 */

export interface SurveyRecord {
  id: string;
  welcomeCard: unknown;
  questions: unknown;
  blocks: unknown[];
  endings: unknown[];
  styling: unknown;
  metadata: unknown;
}

export interface ProjectRecord {
  id: string;
  styling: unknown;
  logo: unknown;
}

export interface OrganizationRecord {
  id: string;
  whitelabel: unknown;
}

export interface ResponseRecord {
  id: string;
  data: unknown;
}

export interface MigrationStats {
  surveysProcessed: number;
  surveysUpdated: number;
  projectsProcessed: number;
  projectsUpdated: number;
  organizationsProcessed: number;
  organizationsUpdated: number;
  responsesProcessed: number;
  responsesUpdated: number;
  urlsConverted: number;
  errors: number;
}
