export interface KeyTypeAnalysis {
  id: string;
  key: string;
  detected_type: "string" | "number" | "date";
  non_empty_count: bigint;
}

export interface MigrationStats {
  totalKeys: number;
  defaultKeys: number;
  customKeys: number;
  processedKeys: number;
  numberTypeKeys: number;
  dateTypeKeys: number;
  stringTypeKeys: number;
  skippedEmptyKeys: number;
  totalAttributeRows: number;
  valueBackfillSkipped: boolean;
  numberRowsBackfilled: number;
  dateRowsBackfilled: number;
}
