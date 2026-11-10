/**
 * A survey's responses are served in the response card's shape (`serializeResponseCard`), which is what
 * the Responses page's table and its cards render; only the count has a shape of its own.
 */

/** How many of the survey's responses match the filter. */
export type TSurveyResponseCountResource = { count: number };
