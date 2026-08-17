import nextConfig from "eslint-config-next";
import { base, commonIgnores, typescriptParsing } from "./base.mjs";

/*
 * Flat config for the Next.js app — the successor of `legacy-next.js`:
 * eslint-config-next + turbo + prettier + the vitest convention, with the same rule
 * overrides the legacy config carried. Deliberately does not add the
 * eslint/typescript-eslint recommended baselines yet to keep rule parity with the
 * previous setup — tightening is a separate step (ENG-2264).
 */
export const next = [
  commonIgnores,
  typescriptParsing,
  ...nextConfig,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "react/jsx-key": "off",
    },
  },
  ...base,
];

export default next;
