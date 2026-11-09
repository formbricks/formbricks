/**
 * Translation Key Scanner
 *
 * This script scans the web app for translation keys and validates them against
 * the translation files. It detects missing keys, unused keys, and translated
 * messages whose interpolation placeholders no longer match the default locale's.
 *
 * Usage:
 *   pnpm scan-translations
 *
 * Exit codes:
 *   0: Success, no issues found
 *   1: Validation errors found (missing/unused keys, placeholder mismatches, stale lockfile)
 *   2: Invalid or missing API key
 */
import { type MessageFormatElement, TYPE, parse } from "@formatjs/icu-messageformat-parser";
import { glob } from "glob";
import * as fs from "node:fs";
import * as path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import objectHash from "object-hash";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration for Web App
const WEB_APP_DIR = path.join(__dirname, "..", "..", "..", "apps", "web");
const EMAIL_PKG_DIR = path.join(__dirname, "..", "..", "..", "packages", "email");
const WEB_APP_LOCALES_DIR = path.join(WEB_APP_DIR, "locales");
const WEB_APP_DEFAULT_LOCALE = "en-US";

// Configuration for Surveys Package
const SURVEYS_PKG_DIR = path.join(__dirname, "..", "..", "..", "packages", "surveys");
const SURVEYS_LOCALES_DIR = path.join(SURVEYS_PKG_DIR, "locales");
const SURVEYS_DEFAULT_LOCALE = "en-US";

// Patterns to match translation keys
const TRANSLATION_PATTERNS = [
  // Pattern: t("key") or t('key')
  /\bt\s*\(\s*["'](?<temp1>[^"']+)["']/g,
  // Pattern: t(`key`)
  /\bt\s*\(\s*`(?<temp1>[^`]+)`/g,
  // Pattern: <Trans i18nKey="key" /> or <Trans i18nKey='key' />
  /i18nKey\s*=\s*["'](?<temp1>[^"']+)["']/g,
  // Pattern: <Trans i18nKey={"key"} /> or <Trans i18nKey={'key'} />
  /i18nKey\s*=\s*\{\s*["'](?<temp1>[^"']+)["']\s*\}/g,
];

// Extracts string literals from dynamic i18nKey={...} expressions (e.g. ternaries)
const I18N_KEY_BLOCK_PATTERN = /i18nKey\s*=\s*\{(?<block>[\s\S]*?)\}/g;
const STRING_LITERAL_PATTERN = /["'](?<key>[^"']+)["']/g;

// Directories and files to exclude from scanning
const EXCLUDE_DIRS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/locales/**",
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.spec.ts",
  "**/*.spec.tsx",
];

export interface TranslationKeys {
  [key: string]: string | TranslationKeys;
}

export interface LockfileValidationResults {
  missing: string[];
  outOfSync: string[];
  extra: string[];
}

/**
 * The interpolation placeholders a message expects, split by syntax.
 *
 * `i18next-icu` formats with `IntlMessageFormat`, which only understands `{name}`: a message carrying
 * `{{name}}` fails to parse and renders as its raw source. `en-US` has none, but translations have
 * picked the syntax up, so it is still recognised. The two are compared separately on purpose — a locale that "translates" `{surveys}` into
 * `{{surveys}}` is exactly the breakage this check exists to catch, and treating them as equivalent
 * would hide it.
 */
export interface PlaceholderSet {
  icu: string[]; // `{name}`, `{count, plural, ...}`, `{count, select, ...}`
  i18next: string[]; // `{{name}}`
}

/** A key whose placeholders disagree between the default locale and a target locale. */
export interface PlaceholderMismatch {
  key: string;
  expected: PlaceholderSet;
  /** `null` when the target message cannot be parsed as ICU at all (it renders literally). */
  actual: PlaceholderSet | null;
}

export interface ScanResults {
  usedKeys: Set<string>;
  translationKeys: Set<string>;
  missingKeys: Set<string>;
  unusedKeys: Set<string>;
  incompleteTranslations: Map<string, string[]>; // locale -> missing keys
  placeholderMismatches: Map<string, PlaceholderMismatch[]>; // locale -> keys whose placeholders drifted
  keysWithSpaces: Set<string>; // keys that contain spaces
  lockfileValidation?: LockfileValidationResults | null;
}

/**
 * Walk every leaf of a nested translation object, calling `visit` with its dotted key and value.
 */
function walkValues(
  obj: TranslationKeys,
  prefix: string,
  visit: (key: string, value: unknown) => void
): void {
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (value && typeof value === "object" && !Array.isArray(value)) {
      walkValues(value, fullKey, visit);
    } else {
      visit(fullKey, value);
    }
  }
}

/**
 * Recursively flatten nested translation keys
 */
export function flattenKeys(obj: TranslationKeys, prefix = ""): string[] {
  const keys: string[] = [];
  walkValues(obj, prefix, (key) => keys.push(key));
  return keys;
}

/**
 * Flatten a translation file to dotted key -> message. Non-string leaves are skipped: a number has no
 * placeholders to compare.
 */
export function flattenValues(obj: TranslationKeys, prefix = ""): Record<string, string> {
  // Null prototype: a translation key literally named `__proto__` becomes a plain entry instead of
  // being swallowed by the prototype setter.
  const values: Record<string, string> = Object.create(null) as Record<string, string>;
  walkValues(obj, prefix, (key, value) => {
    if (typeof value === "string") {
      values[key] = value;
    }
  });
  return values;
}

// Only plain `{{name}}` interpolation is recognised. i18next format specs (`{{date, datetime}}`)
// do not appear in the locale files; one would fail ICU parsing and be reported, not misread.
const I18NEXT_PLACEHOLDER_PATTERN = /\{\{\s*([\w.$-]+)\s*\}\}/g;

/**
 * Extract the interpolation placeholders a message expects.
 *
 * ICU messages are parsed with `ignoreTag: true` — the same option `i18next-icu` hands
 * `IntlMessageFormat` at runtime — so HTML is treated as literal text and only real arguments are
 * collected.
 *
 * The message is parsed as ICU first. `{{name}}` is only pulled out when that fails, because the same
 * characters are valid ICU inside a branch — `{count, plural, other {{count}}}` is the `other` branch
 * wrapping `{count}` — and stripping them there would misread a message the runtime formats fine.
 *
 * Throws when the message is not valid ICU, which the runtime also cannot format.
 */
export function extractPlaceholders(message: string): PlaceholderSet {
  const icu = new Set<string>();
  const i18next = new Set<string>();

  let elements: MessageFormatElement[];
  try {
    elements = parse(message, { ignoreTag: true });
  } catch (icuError) {
    const icuMessage = message.replaceAll(I18NEXT_PLACEHOLDER_PATTERN, (_match, name: string) => {
      i18next.add(name);
      return "";
    });
    if (i18next.size === 0) throw icuError;
    elements = parse(icuMessage, { ignoreTag: true });
  }

  collectIcuArguments(elements, icu);

  return {
    icu: [...icu].sort((a, b) => a.localeCompare(b)),
    i18next: [...i18next].sort((a, b) => a.localeCompare(b)),
  };
}

function collectIcuArguments(elements: readonly MessageFormatElement[], into: Set<string>): void {
  for (const element of elements) {
    switch (element.type) {
      case TYPE.argument:
      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
        into.add(element.value);
        break;
      case TYPE.plural:
      case TYPE.select:
        into.add(element.value);
        for (const option of Object.values(element.options)) {
          collectIcuArguments(option.value, into);
        }
        break;
      default:
        break; // literal and pound carry no variable; tags never appear because tags are ignored
    }
  }
}

/**
 * Remove comments from content to avoid detecting translation keys in comments
 * This function carefully preserves // in URLs and strings while removing actual comments
 */
export function stripComments(content: string): string {
  // Remove multi-line comments (/* ... */) first
  let result = content.replaceAll(/\/\*[\s\S]*?\*\//g, "");

  // Remove single-line comments, but be careful not to match:
  // - https:// or http:// in URLs
  // - // inside strings
  // This regex matches // that is NOT preceded by : (to avoid https://)
  // and removes everything after it until end of line
  result = result.replaceAll(/(?<!:)\/\/.*$/gm, "");

  return result;
}

/**
 * Extract translation keys from a file's content
 */
export function extractKeysFromContent(content: string): string[] {
  const keys: string[] = [];

  // Strip comments first to avoid detecting keys in comments
  const contentWithoutComments = stripComments(content);

  for (const pattern of TRANSLATION_PATTERNS) {
    let match: RegExpExecArray | null = null;
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;

    while ((match = pattern.exec(contentWithoutComments)) !== null) {
      const key = match[1];
      // Skip dynamic keys (containing variables like ${}, {{}} etc.)
      if (!key.includes("${") && !key.includes("{{") && !key.includes("}")) {
        keys.push(key);
      }
    }
  }

  // Extract keys from dynamic i18nKey={...} expressions (e.g. ternaries, conditionals)
  I18N_KEY_BLOCK_PATTERN.lastIndex = 0;
  let blockMatch: RegExpExecArray | null = null;
  while ((blockMatch = I18N_KEY_BLOCK_PATTERN.exec(contentWithoutComments)) !== null) {
    const blockContent = blockMatch.groups?.block ?? "";
    STRING_LITERAL_PATTERN.lastIndex = 0;
    let strMatch: RegExpExecArray | null = null;
    while ((strMatch = STRING_LITERAL_PATTERN.exec(blockContent)) !== null) {
      const key = strMatch.groups?.key ?? "";
      if (key.includes(".") && !key.includes("${") && !key.includes(" ")) {
        keys.push(key);
      }
    }
  }

  return keys;
}

/**
 * Source files read at once. The reads are independent (each only adds to a set), so reading them one
 * after another left the scan waiting on each in turn; a bounded pool overlaps them without opening
 * thousands of files at once (`EMFILE`).
 */
const FILE_READ_CONCURRENCY = 32;

/**
 * Run `task` over `items` with at most `concurrency` (a positive integer) in flight, settling once every
 * task has finished. A task that rejects does not stop the others: every item still runs, and the run
 * then rejects with an `AggregateError` of each failure, so nothing is left in flight when it settles.
 */
export async function forEachConcurrently<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  if (!Number.isSafeInteger(concurrency) || concurrency <= 0) {
    throw new Error(`forEachConcurrently: concurrency must be a positive integer, got ${concurrency}`);
  }
  let next = 0;
  const failures: unknown[] = [];
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      try {
        await task(item);
      } catch (error) {
        failures.push(error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  if (failures.length > 0) {
    throw new AggregateError(failures, `forEachConcurrently: ${failures.length.toString()} task(s) failed`);
  }
}

/**
 * Scan source files for translation keys
 */
async function scanSourceFiles(sourceDirs: string | string[], packageName: string): Promise<Set<string>> {
  console.log(`🔍 Scanning ${packageName} source files for translation keys...`);

  const usedKeys = new Set<string>();
  const dirs = Array.isArray(sourceDirs) ? sourceDirs : [sourceDirs];

  for (const dir of dirs) {
    // Find all TypeScript and TypeScript React files
    const files = await glob("**/*.{ts,tsx}", {
      cwd: dir,
      ignore: EXCLUDE_DIRS,
      absolute: true,
    });

    console.log(
      `   Found ${files.length.toString()} files to scan in ${path.relative(path.join(__dirname, "..", "..", ".."), dir)}`
    );

    await forEachConcurrently(files, FILE_READ_CONCURRENCY, async (file) => {
      try {
        const content = await fs.promises.readFile(file, "utf-8");
        const keys = extractKeysFromContent(content);
        keys.forEach((key) => usedKeys.add(key));
      } catch (error) {
        console.error(`❌ Error: Could not read file ${file}:`, error);
      }
    });
  }

  console.log(`   ✅ Found ${usedKeys.size.toString()} unique translation keys\n`);

  return usedKeys;
}

/**
 * Get all locale files in the locales directory
 */
async function getLocaleFiles(localesDir: string): Promise<string[]> {
  try {
    const files = await fs.promises.readdir(localesDir);
    return files.filter((file) => file.endsWith(".json")).map((file) => file.replace(".json", ""));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`❌ Failed to read locales directory at ${localesDir}: ${errorMessage}`);
  }
}

/** A locale file's keys and its flattened messages; both come from the one read. */
export interface LocaleTranslations {
  keys: Set<string>;
  values: Record<string, string>;
}

/**
 * Load a locale file: its flattened keys, plus the same keys mapped to their messages so placeholder
 * parity can be checked without reading every file twice.
 */
async function loadLocaleTranslations(locale: string, localesDir: string): Promise<LocaleTranslations> {
  const localePath = path.join(localesDir, `${locale}.json`);

  try {
    const content = await fs.promises.readFile(localePath, "utf-8");
    const translations = JSON.parse(content) as TranslationKeys;

    return {
      keys: new Set(flattenKeys(translations)),
      values: flattenValues(translations),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`❌ Failed to parse ${localePath}: ${errorMessage}`);
  }
}

/**
 * Load translation keys from all locale files
 */
export async function loadAllLocaleTranslations(
  localesDir: string,
  defaultLocale: string,
  packageName: string
): Promise<Map<string, LocaleTranslations>> {
  console.log(`📚 Loading ${packageName} translation keys from locale files...`);

  const allLocales = await getLocaleFiles(localesDir);
  const translationsByLocale = new Map<string, LocaleTranslations>();

  // Load all locale files in parallel for better performance
  const localeResults = await Promise.all(
    allLocales.map(async (locale) => {
      const translations = await loadLocaleTranslations(locale, localesDir);
      return { locale, translations };
    })
  );

  // Populate the map and log results
  for (const { locale, translations } of localeResults) {
    translationsByLocale.set(locale, translations);
    console.log(`   • ${locale}.json: ${translations.keys.size.toString()} keys`);
  }
  console.log();

  // Verify default locale exists
  if (!translationsByLocale.has(defaultLocale)) {
    throw new Error(`❌ Default locale ${defaultLocale} not found in ${packageName}`);
  }

  return translationsByLocale;
}

/**
 * Check for incomplete translations across locales
 */
export function checkIncompleteTranslations(
  translationsByLocale: Map<string, LocaleTranslations>,
  defaultLocale: string
): Map<string, string[]> {
  const defaultKeys = translationsByLocale.get(defaultLocale)?.keys;
  if (!defaultKeys) {
    throw new Error(`Default locale ${defaultLocale} not found`);
  }

  const incompleteTranslations = new Map<string, string[]>();

  for (const [locale, translations] of translationsByLocale.entries()) {
    // Skip the default locale
    if (locale === defaultLocale) continue;

    const missingKeys: string[] = [];

    for (const key of defaultKeys) {
      if (!translations.keys.has(key)) {
        missingKeys.push(key);
      }
    }

    if (missingKeys.length > 0) {
      incompleteTranslations.set(locale, missingKeys.sort());
    }
  }

  return incompleteTranslations;
}

/**
 * Parse the default locale once into the reference every other locale is compared against.
 *
 * A default message ICU cannot parse aborts the scan: the runtime cannot format it either, so it
 * renders as its raw source in English, and every translation of it is unchecked. Silently skipping
 * it would leave exactly the blind spot this check exists to close.
 */
function buildPlaceholderReference(defaultValues: Record<string, string>): Map<string, PlaceholderSet> {
  const reference = new Map<string, PlaceholderSet>();

  for (const [key, message] of Object.entries(defaultValues)) {
    try {
      reference.set(key, extractPlaceholders(message));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `❌ Default locale message "${key}" is not valid ICU (${reason}). Escape literal braces as '{' and '}'.`
      );
    }
  }

  return reference;
}

function hasSamePlaceholders(expected: PlaceholderSet, actual: PlaceholderSet | null): boolean {
  if (actual === null) return false;

  // Both lists are sorted, so comparing position by position is set equality.
  return (
    actual.icu.length === expected.icu.length &&
    actual.icu.every((name, index) => name === expected.icu[index]) &&
    actual.i18next.length === expected.i18next.length &&
    actual.i18next.every((name, index) => name === expected.i18next[index])
  );
}

/**
 * Mismatches for one locale: a different placeholder set, or a message ICU cannot parse at all — it
 * then renders literally instead of failing loudly.
 */
function collectPlaceholderMismatches(
  values: Record<string, string>,
  reference: Map<string, PlaceholderSet>
): PlaceholderMismatch[] {
  const mismatches: PlaceholderMismatch[] = [];

  for (const [key, expected] of reference) {
    if (!Object.hasOwn(values, key)) continue;

    let actual: PlaceholderSet | null;
    try {
      actual = extractPlaceholders(values[key]);
    } catch {
      actual = null;
    }

    if (!hasSamePlaceholders(expected, actual)) {
      mismatches.push({ key, expected, actual });
    }
  }

  return mismatches;
}

/**
 * Compare the interpolation placeholders of every key a locale shares with the default locale.
 *
 * This is the check the key-scanner could not do: it validated that keys exist, never that a
 * translation still interpolates what the message is called with. A message that drops `{minutes}`
 * silently renders without the value, and one that keeps `{{surveys}}` renders the braces literally.
 *
 * Placeholders that only the target locale has are reported too: nothing supplies them, so they
 * render as literal braces. A key the locale does not have is skipped — `checkIncompleteTranslations`
 * owns that case. A message that cannot be parsed is reported rather than thrown, since the runtime
 * cannot format it either.
 */
export function checkPlaceholderParity(
  valuesByLocale: Map<string, Record<string, string>>,
  defaultLocale: string
): Map<string, PlaceholderMismatch[]> {
  const defaultValues = valuesByLocale.get(defaultLocale);
  if (!defaultValues) {
    throw new Error(`Default locale ${defaultLocale} not found`);
  }

  const reference = buildPlaceholderReference(defaultValues);
  const mismatches = new Map<string, PlaceholderMismatch[]>();

  for (const [locale, values] of valuesByLocale.entries()) {
    if (locale === defaultLocale) continue;

    const localeMismatches = collectPlaceholderMismatches(values, reference);
    if (localeMismatches.length === 0) continue;

    localeMismatches.sort((a, b) => a.key.localeCompare(b.key));
    mismatches.set(locale, localeMismatches);
  }

  return mismatches;
}

/**
 * Detect keys that contain spaces (which should not be used in translation keys)
 */
export function detectKeysWithSpaces(usedKeys: Set<string>, translationKeys: Set<string>): Set<string> {
  const keysWithSpaces = new Set<string>();

  // Check used keys for spaces
  for (const key of usedKeys) {
    if (/\s/.test(key)) {
      keysWithSpaces.add(key);
    }
  }

  // Check translation keys for spaces
  for (const key of translationKeys) {
    if (/\s/.test(key)) {
      keysWithSpaces.add(key);
    }
  }

  return keysWithSpaces;
}

/**
 * Compare used keys with translation keys to find missing and unused keys
 */
export function compareKeys(
  usedKeys: Set<string>,
  translationKeys: Set<string>,
  translationsByLocale: Map<string, LocaleTranslations>,
  defaultLocale: string,
  packageName: string
): ScanResults {
  console.log(`🔄 Comparing ${packageName} keys...`);

  const missingKeys = new Set<string>();
  const unusedKeys = new Set<string>();

  // Find missing keys (used but not in translations)
  for (const key of usedKeys) {
    if (!translationKeys.has(key)) {
      missingKeys.add(key);
    }
  }

  // Find unused keys (in translations but not used)
  for (const key of translationKeys) {
    if (!usedKeys.has(key)) {
      unusedKeys.add(key);
    }
  }

  // Check for incomplete translations across locales
  const incompleteTranslations = checkIncompleteTranslations(translationsByLocale, defaultLocale);

  // Check that every translated message interpolates what the default locale's does
  const placeholderMismatches = checkPlaceholderParity(
    new Map(
      Array.from(translationsByLocale, ([locale, translations]) => [locale, translations.values] as const)
    ),
    defaultLocale
  );

  // Detect keys with spaces
  const keysWithSpaces = detectKeysWithSpaces(usedKeys, translationKeys);

  console.log();

  return {
    usedKeys,
    translationKeys,
    missingKeys,
    unusedKeys,
    incompleteTranslations,
    placeholderMismatches,
    keysWithSpaces,
  };
}

function describePlaceholders(set: PlaceholderSet | null): string {
  if (set === null) return "(not valid ICU)";

  const parts = [...set.icu.map((name) => `{${name}}`), ...set.i18next.map((name) => `{{${name}}}`)];
  return parts.length > 0 ? parts.join(" ") : "(none)";
}

function displayPlaceholderMismatches(
  mismatchesByLocale: Map<string, PlaceholderMismatch[]>,
  defaultLocale: string
): void {
  console.log(`\n❌ PLACEHOLDER MISMATCHES:\n`);
  console.log(`   These messages do not interpolate what ${defaultLocale} does. A dropped or`);
  console.log('   rewritten placeholder renders literally, e.g. "{name}" or "{{name}}".\n');

  for (const [locale, mismatches] of mismatchesByLocale.entries()) {
    console.log(`   ❌ ${locale} (${mismatches.length.toString()} keys):`);

    // Show the first 10 per locale, same as the other sections, to keep the output readable
    for (const { key, expected, actual } of mismatches.slice(0, 10)) {
      console.log(`      • ${key}`);
      console.log(`        ${defaultLocale}: ${describePlaceholders(expected)}`);
      console.log(`        ${locale}: ${describePlaceholders(actual)}`);
    }

    if (mismatches.length > 10) {
      console.log(`      ... and ${(mismatches.length - 10).toString()} more`);
    }
  }
}

/** Whether the lockfile could not be validated, or disagrees with the default locale. */
export function hasLockfileIssues(results: ScanResults): boolean {
  const lockfile = results.lockfileValidation;
  return (
    !lockfile || lockfile.missing.length > 0 || lockfile.outOfSync.length > 0 || lockfile.extra.length > 0
  );
}

/** Whether a package's scan found anything that fails validation. */
export function hasValidationIssues(results: ScanResults): boolean {
  return (
    results.missingKeys.size > 0 ||
    results.unusedKeys.size > 0 ||
    results.incompleteTranslations.size > 0 ||
    results.placeholderMismatches.size > 0 ||
    results.keysWithSpaces.size > 0 ||
    hasLockfileIssues(results)
  );
}

/**
 * Display validation results
 */
export function displayResults(results: ScanResults, packageName: string, defaultLocale: string): void {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`              ${packageName} VALIDATION RESULTS              `);
  console.log("═══════════════════════════════════════════════════════════\n");

  if (!hasValidationIssues(results)) {
    console.log("✅ All translation keys are valid!\n");
    console.log(`   • ${results.usedKeys.size.toString()} keys used in code`);
    console.log(`   • ${results.translationKeys.size.toString()} keys in translations`);
    console.log(`   • 0 missing keys`);
    console.log(`   • 0 unused keys`);
    console.log(`   • 0 keys with spaces`);
    console.log(`   • All locales complete`);
    console.log(`   • All locale placeholders match\n`);
    return;
  }

  if (results.missingKeys.size > 0) {
    console.log(`❌ MISSING KEYS (${results.missingKeys.size.toString()}):\n`);
    console.log("   These keys are used in code but not found in translation files:\n");
    const sortedMissingKeys = Array.from(results.missingKeys).sort();
    sortedMissingKeys.forEach((key) => {
      console.log(`   • ${key}`);
    });
  }

  if (results.unusedKeys.size > 0) {
    console.log(`\n⚠️  UNUSED KEYS (${results.unusedKeys.size.toString()}):\n`);
    console.log("   These keys exist in translation files but are not used in code:\n");
    const sortedUnusedKeys = Array.from(results.unusedKeys).sort();
    sortedUnusedKeys.forEach((key) => {
      console.log(`   • ${key}`);
    });
  }

  if (results.incompleteTranslations.size > 0) {
    console.log(`\n⚠️  INCOMPLETE TRANSLATIONS:\n`);
    console.log(`   Some keys from ${defaultLocale} are missing in target languages:\n`);

    for (const [locale, missingKeys] of results.incompleteTranslations.entries()) {
      console.log(`   📝 ${locale} (${missingKeys.length.toString()} missing keys):`);

      // Show first 10 missing keys for each locale to avoid overwhelming output
      const keysToShow = missingKeys.slice(0, 10);
      keysToShow.forEach((key) => {
        console.log(`      • ${key}`);
      });

      if (missingKeys.length > 10) {
        const moreKeys = missingKeys.length - 10;
        console.log(`      ... and ${moreKeys.toString()} more`);
      }
    }
  }

  if (results.placeholderMismatches.size > 0) {
    displayPlaceholderMismatches(results.placeholderMismatches, defaultLocale);
  }

  if (results.keysWithSpaces.size > 0) {
    console.log(`\n❌ KEYS WITH SPACES (${results.keysWithSpaces.size.toString()}):\n`);
    console.log("   Translation keys should not contain spaces. These keys have spaces:\n");
    const sortedKeysWithSpaces = Array.from(results.keysWithSpaces).sort();
    sortedKeysWithSpaces.forEach((key) => {
      // Show the key with visible spaces marked
      const visualKey = key.replaceAll(" ", "␣").replaceAll("\t", "⇥").replaceAll("\n", "↵");
      console.log(`   • "${visualKey}"`);
    });
    console.log("\n   Please remove spaces from these keys or use valid key names.\n");
  }

  if (results.lockfileValidation) {
    const { missing, outOfSync, extra } = results.lockfileValidation;

    if (hasLockfileIssues(results)) {
      console.log(`❌ LOCKFILE OUT OF SYNC:\n`);
      console.log(`   Please run "pnpm i" and then "pnpm i18n" to regenerate i18n.lock.\n`);

      if (missing.length > 0) {
        console.log(`   • Keys missing from lockfile (${missing.length.toString()}):`);
        missing.slice(0, 10).forEach((key) => {
          console.log(`      - ${key}`);
        });
        if (missing.length > 10) {
          console.log(`      ... and ${(missing.length - 10).toString()} more`);
        }
      }

      if (outOfSync.length > 0) {
        console.log(`   • Keys out of sync/stale in lockfile (${outOfSync.length.toString()}):`);
        outOfSync.slice(0, 10).forEach((key) => {
          console.log(`      - ${key}`);
        });
        if (outOfSync.length > 10) {
          console.log(`      ... and ${(outOfSync.length - 10).toString()} more`);
        }
      }

      if (extra.length > 0) {
        console.log(`   • Unused/extra keys in lockfile (${extra.length.toString()}):`);
        extra.slice(0, 10).forEach((key) => {
          console.log(`      - ${key}`);
        });
        if (extra.length > 10) {
          console.log(`      ... and ${(extra.length - 10).toString()} more`);
        }
      }
      console.log();
    }
  } else {
    console.log(`❌ LOCKFILE MISSING:\n`);
    console.log(`   Could not find i18n.lock file. Please run "pnpm i18n" to generate it.\n`);
  }

  console.log("═══════════════════════════════════════════════════════════\n");
}
export function parseLockfile(content: string): Record<string, string> {
  const checksums: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  const regex = /^\s{4}(?<key>[^:]+):\s*(?<hash>[a-f0-9]{32})\s*$/;
  for (const line of lines) {
    const match = regex.exec(line);
    if (match?.groups) {
      const key = match.groups.key;
      const hash = match.groups.hash;
      checksums[key] = hash;
    }
  }
  return checksums;
}

async function loadDefaultLocaleWithValues(
  localesDir: string,
  defaultLocale: string
): Promise<Record<string, string>> {
  const localePath = path.join(localesDir, `${defaultLocale}.json`);
  const content = await fs.promises.readFile(localePath, "utf-8");
  const translations = JSON.parse(content) as TranslationKeys;

  const flattened: Record<string, string> = {};

  function recurse(obj: TranslationKeys, prefix = ""): void {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}/${key}` : key;
      const value = obj[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        recurse(value, fullKey);
      } else if (typeof value === "string") {
        flattened[fullKey] = value;
      }
    }
  }

  recurse(translations);
  return flattened;
}

export async function validateLockfile(
  localesDir: string,
  defaultLocale: string
): Promise<LockfileValidationResults | null> {
  const lockfilePath = path.join(localesDir, "..", "i18n.lock");

  try {
    await fs.promises.access(lockfilePath);
  } catch {
    return null;
  }

  const lockfileContent = await fs.promises.readFile(lockfilePath, "utf-8");
  const lockChecksums = parseLockfile(lockfileContent);
  const sourceKeysWithValues = await loadDefaultLocaleWithValues(localesDir, defaultLocale);

  const missing: string[] = [];
  const outOfSync: string[] = [];
  const extra: string[] = [];

  for (const [key, val] of Object.entries(sourceKeysWithValues)) {
    const expected = objectHash.MD5(val);
    const actual = lockChecksums[key];
    if (!actual) {
      missing.push(key);
    } else if (actual !== expected) {
      outOfSync.push(key);
    }
  }

  for (const key of Object.keys(lockChecksums)) {
    if (!(key in sourceKeysWithValues)) {
      extra.push(key);
    }
  }

  return { missing, outOfSync, extra };
}

/**
 * Validate translations for a single package
 */
async function validatePackage(
  sourceDirs: string | string[],
  localesDir: string,
  defaultLocale: string,
  packageName: string
): Promise<ScanResults> {
  // Scan source files for used keys
  const usedKeys = await scanSourceFiles(sourceDirs, packageName);

  // Load translation keys from all locale files
  const translationsByLocale = await loadAllLocaleTranslations(localesDir, defaultLocale, packageName);
  const defaultTranslations = translationsByLocale.get(defaultLocale);

  if (!defaultTranslations) {
    throw new Error(`Default locale ${defaultLocale} not found in ${packageName}`);
  }

  // Compare and find issues
  const results = compareKeys(
    usedKeys,
    defaultTranslations.keys,
    translationsByLocale,
    defaultLocale,
    packageName
  );

  // Run lockfile validation
  const lockfileValidation = await validateLockfile(localesDir, defaultLocale);
  const resultsWithLockfile: ScanResults = {
    ...results,
    lockfileValidation,
  };

  // Display results
  displayResults(resultsWithLockfile, packageName, defaultLocale);

  return resultsWithLockfile;
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║         Translation Key Validation for Formbricks        ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();

  try {
    // Validate Web App
    const webAppResults = await validatePackage(
      [WEB_APP_DIR, EMAIL_PKG_DIR],
      WEB_APP_LOCALES_DIR,
      WEB_APP_DEFAULT_LOCALE,
      "Web App"
    );

    // Validate Surveys Package
    const surveysResults = await validatePackage(
      SURVEYS_PKG_DIR,
      SURVEYS_LOCALES_DIR,
      SURVEYS_DEFAULT_LOCALE,
      "Surveys Package"
    );

    // Check if any package has issues
    // Exit with error if validation failed for any package
    if (hasValidationIssues(webAppResults) || hasValidationIssues(surveysResults)) {
      console.error("═══════════════════════════════════════════════════════════");
      console.error("❌ Translation validation failed!\n");
      console.error("   Please fix the issues above before committing.\n");

      if (webAppResults.missingKeys.size > 0 || surveysResults.missingKeys.size > 0) {
        console.error("   • Add missing keys to your translation files");
      }
      if (webAppResults.unusedKeys.size > 0 || surveysResults.unusedKeys.size > 0) {
        console.error("   • Remove unused keys from translation files");
      }
      if (webAppResults.keysWithSpaces.size > 0 || surveysResults.keysWithSpaces.size > 0) {
        console.error("   • Remove spaces from translation keys (use underscores or camelCase instead)");
      }
      if (webAppResults.incompleteTranslations.size > 0 || surveysResults.incompleteTranslations.size > 0) {
        console.error("   • Complete missing translations in target language files");
      }
      if (webAppResults.placeholderMismatches.size > 0 || surveysResults.placeholderMismatches.size > 0) {
        console.error(
          "   • Keep every {placeholder} the default locale uses in the translated message, in the same syntax"
        );
      }
      if (hasLockfileIssues(webAppResults) || hasLockfileIssues(surveysResults)) {
        console.error("   • Rebuild and update your lockfiles (run 'pnpm i18n')");
      }
      console.error();
      process.exit(1);
    }

    console.log("═══════════════════════════════════════════════════════════");
    console.log("✅ All translation validations passed!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during validation:\n");
    console.error("   ", error);
    console.error();
    process.exit(1);
  }
}

// Run the script only when this file IS the process entrypoint (`tsx src/scan-translations.ts`, i.e.
// `pnpm scan-translations` / `pnpm i18n` / the translation-check workflow).
//
// This module doubles as a library: scan-translations.test.ts imports the pure helpers above. Calling
// main() unconditionally meant that importing it started a full repo-wide scan (~1900 files under
// apps/web) in the background, which then raced the importing test suite for the event loop and ended
// in a process.exit() that could tear the vitest worker down mid-run. Locally the tests finish before
// the scan gets far, so it looked fine; under CI load it surfaced as an unrelated-looking 5s test
// timeout in the SonarQube job.
const entrypointArg = process.argv.at(1);
const isProcessEntrypoint = entrypointArg !== undefined && path.resolve(entrypointArg) === __filename;

if (isProcessEntrypoint) {
  void main();
}
