import "server-only";

export { capturePostHogEvent, groupIdentifyPostHog, identifyPostHogPerson, getEmailDomain } from "./capture";
export type { PostHogGroupContext } from "./capture";
export { getPostHogFeatureFlag } from "./get-feature-flag";
export type { TPostHogFeatureFlagContext, TPostHogFeatureFlagValue } from "./types";

// wrapAiModelWithTracing / instrumentMcpServerWithTracing are intentionally NOT
// re-exported here: this barrel is imported by ~50 unrelated modules for
// capturePostHogEvent alone, and both pull in @posthog/ai / @posthog/mcp (plus
// the MCP SDK) with no tree-shaking guarantee. Import them directly from
// "@/lib/posthog/ai-tracing" / "@/lib/posthog/mcp-tracing" at the call sites
// that actually need them. AI_TRACING_FEATURE lives in the dependency-free
// "@/lib/posthog/ai-tracing-feature" for the same reason.
