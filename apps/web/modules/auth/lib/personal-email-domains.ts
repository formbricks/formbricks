/**
 * Curated list of the most common personal / free email providers, kept intentionally small and
 * hand-editable — add domains here as we run into them ("expand as we go").
 *
 * This is a deliberate subset. The full free-provider list (~12,900 domains, incl. the long tail of
 * regional providers) is the `free-email-domains` npm package (Kikobeats, HubSpot-derived):
 * https://github.com/Kikobeats/free-email-domains — vendor a normalized copy of its `domains.json`
 * here if we ever want exhaustive coverage. It isn't a runtime dependency on purpose: it re-publishes
 * daily and ships a postinstall script.
 *
 * Disposable / burner domains are handled separately (and comprehensively) by the
 * `disposable-email-domains` package in `signup-email-domain.ts` — those are long-tail and churn
 * constantly, so a curated handful would catch almost none; the full list is worth carrying there.
 */
export const PERSONAL_EMAIL_DOMAINS: readonly string[] = [
  // Google
  "gmail.com",
  "googlemail.com",
  // Microsoft
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  // Yahoo / AOL
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "aol.com",
  // Apple
  "icloud.com",
  "me.com",
  "mac.com",
  // Privacy-focused
  "proton.me",
  "protonmail.com",
  "pm.me",
  "mailbox.org",
  // Other mainstream / international
  "gmx.com",
  "gmx.net",
  "yandex.com",
  "yandex.ru",
  "zoho.com",
  "mail.com",
  "qq.com",
  "163.com",
  "126.com",
  "yeah.net",
];
