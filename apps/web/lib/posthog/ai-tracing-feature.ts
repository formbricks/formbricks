// Deliberately dependency-free (no `server-only`, no PostHog SDK import): most
// callers only need this string enum to tag an `aiTracing` context, not the
// `@posthog/ai`-wrapping logic in `ai-tracing.ts`. Importing from here instead
// of `ai-tracing.ts` keeps those callers free of the SDK entirely.
export const AI_TRACING_FEATURE = {
  SurveyGeneration: "ai_survey_generation",
  ChartQuery: "ai_chart_query",
  Translation: "ai_translation",
  ExampleResponses: "ai_example_responses",
} as const;

export type AITracingFeature = (typeof AI_TRACING_FEATURE)[keyof typeof AI_TRACING_FEATURE];
