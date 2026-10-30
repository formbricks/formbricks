import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TSurveyImportLane } from "../core/lane";
import { type TPreparedQsfImport, prepareQsfImport, runQsfImport } from "./pipeline";

/** What the stream route hands the Qualtrics lane: the parsed export and its file name. */
export interface TQsfImportInput {
  qsf: Record<string, unknown>;
  fileName: string;
}

/**
 * The Qualtrics lane: a `.qsf` export, read by code and planned with AI (ENG-3654). It spends AI tokens,
 * so it is charged to Create with AI's bucket too.
 */
export const qsfImportLane: TSurveyImportLane<TQsfImportInput, TPreparedQsfImport> = {
  kind: "qsf",
  usesAI: true,
  rateLimit: rateLimitConfigs.api.v3SurveyGenerate,
  prepare: ({ qsf, fileName }) => prepareQsfImport(qsf, fileName),
  run: (params) => runQsfImport(params),
};
