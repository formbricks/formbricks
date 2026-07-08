// Counts offered in the "Generate example responses" popover and accepted by the
// generate-example-responses server action. Kept in one client-safe module (no
// "server-only", no heavy imports) so the popover's selectable options and the
// server-side validation can never drift apart.
export const EXAMPLE_RESPONSE_COUNT_OPTIONS = [10, 25, 50] as const;

export type TExampleResponseCount = (typeof EXAMPLE_RESPONSE_COUNT_OPTIONS)[number];

// Pre-selected option and the fallback used when no count is supplied.
export const DEFAULT_EXAMPLE_RESPONSE_COUNT: TExampleResponseCount = 10;
