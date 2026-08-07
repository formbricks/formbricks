import "server-only";
import { withTracing } from "@posthog/ai/vercel";
import type { AIResolvedLanguageModel } from "@formbricks/ai";
import { logger } from "@formbricks/logger";
import type { AITracingFeature } from "./ai-tracing-feature";
import { posthogTracingClient } from "./server";

export interface AITracingContext {
  distinctId: string;
  feature: AITracingFeature;
  traceId?: string;
  organizationId?: string;
  workspaceId?: string;
}

const buildGroups = (context: AITracingContext): Record<string, string> | undefined => {
  const groups: Record<string, string> = {};
  if (context.organizationId) groups.organization = context.organizationId;
  if (context.workspaceId) groups.workspace = context.workspaceId;
  return Object.keys(groups).length > 0 ? groups : undefined;
};

/**
 * Wraps a Vercel AI SDK language model with PostHog LLM Observability tracing.
 * No-ops (returns the model unchanged) when PostHog isn't configured, or when
 * wrapping itself fails for any reason - a broken/incompatible analytics SDK
 * must never take down survey generation, translation, or any other AI feature.
 */
export function wrapAiModelWithTracing(
  model: AIResolvedLanguageModel,
  context: AITracingContext
): AIResolvedLanguageModel {
  if (!posthogTracingClient) return model;

  try {
    return withTracing(model, posthogTracingClient, {
      posthogDistinctId: context.distinctId,
      posthogTraceId: context.traceId,
      posthogGroups: buildGroups(context),
      posthogProperties: { feature: context.feature },
      posthogPrivacyMode: true,
    });
  } catch (error) {
    logger.warn({ error, feature: context.feature }, "Failed to wrap AI model with PostHog tracing");
    return model;
  }
}
