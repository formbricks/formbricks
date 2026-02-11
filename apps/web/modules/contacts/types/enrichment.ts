import { z } from "zod";

// Enrichment configuration schema
export const ZEnrichmentConfig = z.object({
  apiUrl: z.string().url(),
  apiMethod: z.enum(["GET", "POST"]),
  authType: z.enum(["none", "bearer", "apiKey", "basic"]),
  authValue: z.string().optional(),
  lookupColumn: z.string(), // CSV column to use for lookup (e.g., "email")
  requestBodyTemplate: z.string().optional(), // JSON template for POST requests
  responseMapping: z.record(z.string(), z.string()), // Maps API response fields to contact attributes
  timeout: z.number().default(5000),
});

export type TEnrichmentConfig = z.infer<typeof ZEnrichmentConfig>;

// Enrichment result for a single contact
export const ZEnrichmentResult = z.object({
  success: z.boolean(),
  originalData: z.record(z.string()),
  enrichedData: z.record(z.string()).optional(),
  error: z.string().optional(),
});

export type TEnrichmentResult = z.infer<typeof ZEnrichmentResult>;

// Batch enrichment response
export const ZBatchEnrichmentResponse = z.object({
  results: z.array(ZEnrichmentResult),
  totalProcessed: z.number(),
  successCount: z.number(),
  errorCount: z.number(),
});

export type TBatchEnrichmentResponse = z.infer<typeof ZBatchEnrichmentResponse>;
