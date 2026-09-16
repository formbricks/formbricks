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
  "hotmail.fr",
  "live.com",
  "live.nl",
  "msn.com",
  // Yahoo / AOL
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.fr",
  "ymail.com",
  "rocketmail.com",
  "aol.com",
  // Apple
  "icloud.com",
  "me.com",
  "mac.com",
  "privaterelay.appleid.com",
  // Privacy-focused / relay
  "proton.me",
  "protonmail.com",
  "pm.me",
  "passmail.com",
  "mailbox.org",
  "posteo.de",
  "fastmail.com",
  "mozmail.com",
  "duck.com",
  "anonaddy.com", // addy.io alias service
  "8alias.com", // SimpleLogin alias domain
  "keemail.me", // Tutanota
  "ik.me", // Infomaniak
  "murena.io", // /e/ OS (Murena)
  "firemail.cc", // same operator as cock.li
  // Burner / temp providers the disposable-email-domains package misses
  "cock.li",
  "tmpmailtor.com",
  "allwebemails.com",
  // Other mainstream / international
  "gmx.com",
  "gmx.net",
  "yandex.com",
  "yandex.ru",
  "zoho.com",
  "zohomail.com",
  "mail.com",
  // A mail.com free domain despite the name — same MX and SPF as mail.com, not a data artifact.
  "null.net",
  "qq.com",
  "foxmail.com",
  "163.com",
  "126.com",
  "139.com",
  "yeah.net",
  "emailn.de",
  "sfr.fr",
  "orange.fr",
  "ukr.net",
  "centrum.cz",
  "wp.pl",
  "earthlink.net",
  "roadrunner.com",
  // Typos / lookalikes of gmail.com — neither is Google's, and gmail.cz has no MX at all.
  "gmaill.com",
  "gmail.cz",
];
