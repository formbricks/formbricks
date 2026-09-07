/*
 * Client-safe counterpart of `lib/env.ts` (ENG-1685).
 *
 * Client components cannot use the validated env module: every variable in `lib/env.ts` is
 * declared under `server`, and `@t3-oss/env-nextjs` throws when a server variable is read in the
 * browser. The constants derived from it in `lib/constants.ts` are equally out of reach — that
 * file is marked `import "server-only"`.
 *
 * `NODE_ENV` is the one variable that legitimately belongs on both sides. It is set by the
 * Next.js build itself rather than by a deployment, and the bundler inlines it into the client
 * bundle at build time, so there is nothing for the schema to validate and no way for it to go
 * missing at runtime. This module is therefore the single sanctioned client-side read of
 * `process.env` — anything an operator configures stays server-side, behind `lib/env.ts`.
 */

// eslint-disable-next-line no-restricted-syntax -- the one client-side process.env read; see above
const NODE_ENV = process.env.NODE_ENV;

export const IS_PRODUCTION_BUILD = NODE_ENV === "production";

export const IS_DEVELOPMENT_BUILD = NODE_ENV === "development";
