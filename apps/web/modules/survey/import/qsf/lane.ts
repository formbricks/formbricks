import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TSurveyImportLane } from "../core/lane";
import { runQsfImport } from "./pipeline";
import type { TPreparedQsfImport } from "./prepare";

/**
 * What the stream route hands the Qualtrics lane: the read of the export (`prepareQsfImport`), which
 * runs in the upload's thread once the lane's rate limit and AI gate have let it through.
 */
export interface TQsfImportInput {
  read: () => Promise<TPreparedQsfImport>;
}

/**
 * The Qualtrics lane: a `.qsf` export, read by code and planned with AI (ENG-3654). It spends AI tokens,
 * so it is charged to Create with AI's bucket too.
 */
export const qsfImportLane: TSurveyImportLane<TQsfImportInput, TPreparedQsfImport> = {
  kind: "qsf",
  usesAI: true,
  rateLimit: rateLimitConfigs.api.v3SurveyGenerate,
  prepare: ({ read }) => read(),
  run: (params) => runQsfImport(params),
};
