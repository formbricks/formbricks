import { z } from "zod";
import type { TV3SurveyGenerateResult } from "@/app/api/v3/surveys/generate/service";
import { mcpToolOutput } from "./output-schemas";

/**
 * Output schemas for the survey tools, apart from the inputs so the strict-input test covers only inputs.
 *
 * The generated draft: `payload` is a v3 create body, opaque here because `create_survey` parses it, and
 * `validation` says whether that body would be accepted. Typed against the service's result, so a field
 * the service adds or drops fails the typecheck here.
 */
export const ZMcpGeneratedSurveyOutput = mcpToolOutput(
  z
    .object({
      language: z.string(),
      payload: z.record(z.string(), z.unknown()),
      validation: z
        .object({
          valid: z.boolean(),
          invalid_params: z.array(z.object({ name: z.string(), reason: z.string() }).loose()),
          languages: z.array(
            z.object({ code: z.string(), default: z.boolean(), enabled: z.boolean() }).loose()
          ),
        })
        .loose(),
    })
    .loose() satisfies z.ZodType<Omit<TV3SurveyGenerateResult, "payload"> & { payload: unknown }>
);
