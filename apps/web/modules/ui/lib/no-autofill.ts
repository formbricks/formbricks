/**
 * Spread on a text input that is not a form field to fill: a search box or a combobox. `autoComplete`
 * stops the browser; password managers ignore it and read their own opt-out attributes instead, so
 * each one is named. Without them a field labelled "City" gets an address suggestion over its own list.
 */
export const NO_AUTOFILL_PROPS = {
  autoComplete: "off",
  "data-lpignore": "true", // LastPass
  "data-1p-ignore": "true", // 1Password
  "data-bwignore": "true", // Bitwarden
  "data-form-type": "other", // Dashlane
} as const;
