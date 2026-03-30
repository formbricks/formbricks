export interface SurveyElement {
  id: string;
  type: string;
  charLimit?: {
    enabled?: boolean;
    min?: number;
    max?: number;
  };
  allowedFileExtensions?: string[];
  validation?: {
    rules: ValidationRule[];
    logic?: "and" | "or";
  };
  [key: string]: unknown;
}

export interface ValidationRule {
  id: string;
  type: string;
  params: {
    min?: number;
    max?: number;
    extensions?: string[];
    [key: string]: unknown;
  };
  field?: string;
}

export interface Block {
  id: string;
  elements: SurveyElement[];
}

export interface SurveyRecord {
  id: string;
  blocks: Block[];
}

export interface MigrationStats {
  totalSurveys: number;
  surveysProcessed: number;
  surveysSkipped: number;
  openTextElementsMigrated: number;
  fileUploadElementsMigrated: number;
  errors: number;
}
