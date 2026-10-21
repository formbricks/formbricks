// Kept free of zod on purpose: the survey renderer imports this at runtime, and a value import from a
// module that builds zod schemas would pull zod into every visitor's bundle.

/**
 * Joins the paths stored in a response's `visitUrls`. A browser percent-encodes spaces in a path, so
 * the separator cannot occur inside one, and splitting on it gives the paths back exactly.
 */
export const VISIT_URLS_SEPARATOR = " · ";
