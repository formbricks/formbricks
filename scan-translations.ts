#!/usr/bin/env tsx
/**
 * Translation Key Scanner for Lingo.dev Integration
 *
 * This script scans the web app for translation keys and validates them against
 * the translation files. It detects missing keys and unused keys.
 *
 * Usage:
 *   pnpm scan-translations
 *
 * Exit codes:
 *   0: Success, no issues found
 *   1: Validation errors found (missing or unused keys)
 *   2: Invalid or missing API key
 */
import { glob } from "glob";
import * as fs from "node:fs";
import * as path from "node:path";

// Configuration
const WEB_APP_DIR = path.join(__dirname, "apps", "web");
const LOCALES_DIR = path.join(WEB_APP_DIR, "locales");
const DEFAULT_LOCALE = "en-US";

// Patterns to match translation keys
const TRANSLATION_PATTERNS = [
  // Pattern: t("key") or t('key')
  /\bt\s*\(\s*["']([^"']+)["']/g,
  // Pattern: t(`key`)
  /\bt\s*\(\s*`([^`]+)`/g,
  // Pattern: <Trans i18nKey="key" /> or <Trans i18nKey='key' />
  /i18nKey\s*=\s*["']([^"']+)["']/g,
  // Pattern: <Trans i18nKey={"key"} /> or <Trans i18nKey={'key'} />
  /i18nKey\s*=\s*\{\s*["']([^"']+)["']\s*\}/g,
];

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

interface ScanResults {
  usedKeys: Set<string>;
  translationKeys: Set<string>;
  missingKeys: Set<string>;
  unusedKeys: Set<string>;
  incompleteTranslations: Map<string, string[]>; // locale -> missing keys
  keysWithSpaces: Set<string>; // keys that contain spaces
}

/**
 * Recursively flatten nested translation keys
 * Example: { auth: { login: "Login" } } => ["auth.login"]
 */
export function flattenKeys(obj: TranslationKeys, prefix: string = ""): string[] {
  let keys: string[] = [];

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys = keys.concat(flattenKeys(value as TranslationKeys, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
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

  return keys;
}

/**
 * Scan source files for translation keys
 */
async function scanSourceFiles(): Promise<Set<string>> {
  console.log("🔍 Scanning source files for translation keys...\n");

  const usedKeys = new Set<string>();

  // Find all TypeScript and TypeScript React files
  const files = await glob("**/*.{ts,tsx}", {
    cwd: WEB_APP_DIR,
    ignore: EXCLUDE_DIRS,
    absolute: true,
  });

  console.log(`Found ${files.length} files to scan\n`);

  for (const file of files) {
    try {
      const content = await fs.promises.readFile(file, "utf-8");
      const keys = extractKeysFromContent(content);
      keys.forEach((key) => usedKeys.add(key));
    } catch (error) {
      console.error(`❌ Error: Could not read file ${file}: ${error}`);
    }
  }

  console.log(`✅ Found ${usedKeys.size} unique translation keys in source files\n`);

  return usedKeys;
}

/**
 * Get all locale files in the locales directory
 */
async function getLocaleFiles(): Promise<string[]> {
  try {
    const files = await fs.promises.readdir(LOCALES_DIR);
    return files.filter((file) => file.endsWith(".json")).map((file) => file.replace(".json", ""));
  } catch (error) {
    throw new Error(`❌ Failed to read locales directory at ${LOCALES_DIR}: ${error}`);
  }
}

/**
 * Load translation keys from a specific locale file
 */
async function loadKeysFromLocale(locale: string): Promise<Set<string>> {
  const localePath = path.join(LOCALES_DIR, `${locale}.json`);
  const translationKeys = new Set<string>();

  try {
    const content = await fs.promises.readFile(localePath, "utf-8");
    const translations = JSON.parse(content);
    const keys = flattenKeys(translations);

    keys.forEach((key) => translationKeys.add(key));

    return translationKeys;
  } catch (error) {
    throw new Error(`❌ Failed to parse ${localePath}: ${error}`);
  }
}

/**
 * Load translation keys from all locale files
 */
async function loadAllTranslationKeys(): Promise<Map<string, Set<string>>> {
  console.log("📚 Loading translation keys from locale files...\n");

  const allLocales = await getLocaleFiles();
  const translationsByLocale = new Map<string, Set<string>>();

  // Load all locale files in parallel for better performance
  const localeResults = await Promise.all(
    allLocales.map(async (locale) => {
      const keys = await loadKeysFromLocale(locale);
      return { locale, keys };
    })
  );

  // Populate the map and log results
  for (const { locale, keys } of localeResults) {
    translationsByLocale.set(locale, keys);
    console.log(`   • ${locale}.json: ${keys.size} keys`);
  }

  console.log();

  // Verify default locale exists
  if (!translationsByLocale.has(DEFAULT_LOCALE)) {
    throw new Error(`❌ Default locale ${DEFAULT_LOCALE} not found`);
  }

  return translationsByLocale;
}

/**
 * Check for incomplete translations across locales
 */
function checkIncompleteTranslations(translationsByLocale: Map<string, Set<string>>): Map<string, string[]> {
  const defaultKeys = translationsByLocale.get(DEFAULT_LOCALE)!;
  const incompleteTranslations = new Map<string, string[]>();

  for (const [locale, keys] of translationsByLocale.entries()) {
    // Skip the default locale
    if (locale === DEFAULT_LOCALE) continue;

    const missingKeys: string[] = [];

    for (const key of defaultKeys) {
      if (!keys.has(key)) {
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
function compareKeys(
  usedKeys: Set<string>,
  translationKeys: Set<string>,
  translationsByLocale: Map<string, Set<string>>
): ScanResults {
  console.log("🔄 Comparing keys...\n");

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
  const incompleteTranslations = checkIncompleteTranslations(translationsByLocale);

  // Detect keys with spaces
  const keysWithSpaces = detectKeysWithSpaces(usedKeys, translationKeys);

  return {
    usedKeys,
    translationKeys,
    missingKeys,
    unusedKeys,
    incompleteTranslations,
    keysWithSpaces,
  };
}

/**
 * Display validation results
 */
function displayResults(results: ScanResults): void {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("                    VALIDATION RESULTS                     ");
  console.log("═══════════════════════════════════════════════════════════\n");

  const hasIssues =
    results.missingKeys.size > 0 ||
    results.unusedKeys.size > 0 ||
    results.incompleteTranslations.size > 0 ||
    results.keysWithSpaces.size > 0;

  if (!hasIssues) {
    console.log("✅ All translation keys are valid!\n");
    console.log(`   • ${results.usedKeys.size} keys used in code`);
    console.log(`   • ${results.translationKeys.size} keys in translations`);
    console.log(`   • 0 missing keys`);
    console.log(`   • 0 unused keys`);
    console.log(`   • 0 keys with spaces`);
    console.log(`   • All locales complete\n`);
    return;
  }

  if (results.missingKeys.size > 0) {
    console.log(`❌ MISSING KEYS (${results.missingKeys.size}):\n`);
    console.log("   These keys are used in code but not found in translation files:\n");
    const sortedMissingKeys = Array.from(results.missingKeys).sort();
    sortedMissingKeys.forEach((key) => {
      console.log(`   • ${key}`);
    });
  }

  if (results.unusedKeys.size > 0) {
    console.log(`\n⚠️  UNUSED KEYS (${results.unusedKeys.size}):\n`);
    console.log("   These keys exist in translation files but are not used in code:\n");
    const sortedUnusedKeys = Array.from(results.unusedKeys).sort();
    sortedUnusedKeys.forEach((key) => {
      console.log(`   • ${key}`);
    });
  }

  if (results.incompleteTranslations.size > 0) {
    console.log(`\n⚠️  INCOMPLETE TRANSLATIONS:\n`);
    console.log(`   Some keys from ${DEFAULT_LOCALE} are missing in target languages:\n`);

    for (const [locale, missingKeys] of results.incompleteTranslations.entries()) {
      console.log(`   📝 ${locale} (${missingKeys.length} missing keys):`);

      // Show first 10 missing keys for each locale to avoid overwhelming output
      const keysToShow = missingKeys.slice(0, 10);
      keysToShow.forEach((key) => {
        console.log(`      • ${key}`);
      });

      if (missingKeys.length > 10) {
        console.log(`      ... and ${missingKeys.length - 10} more`);
      }
    }
  }

  if (results.keysWithSpaces.size > 0) {
    console.log(`\n❌ KEYS WITH SPACES (${results.keysWithSpaces.size}):\n`);
    console.log("   Translation keys should not contain spaces. These keys have spaces:\n");
    const sortedKeysWithSpaces = Array.from(results.keysWithSpaces).sort();
    sortedKeysWithSpaces.forEach((key) => {
      // Show the key with visible spaces marked
      const visualKey = key.replaceAll(" ", "␣").replaceAll("\t", "⇥").replaceAll("\n", "↵");
      console.log(`   • "${visualKey}"`);
    });
    console.log("\n   Please remove spaces from these keys or use valid key names.\n");
  }

  console.log("═══════════════════════════════════════════════════════════\n");
}
/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║         Translation Key Validation for Lingo.dev        ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log();

  try {
    // Scan source files for used keys
    const usedKeys = await scanSourceFiles();

    // Load translation keys from all locale files
    const translationsByLocale = await loadAllTranslationKeys();
    const defaultKeys = translationsByLocale.get(DEFAULT_LOCALE)!;

    // Compare and find issues
    const results = compareKeys(usedKeys, defaultKeys, translationsByLocale);

    // Display results
    displayResults(results);

    // Exit with error if validation failed
    if (
      results.missingKeys.size > 0 ||
      results.unusedKeys.size > 0 ||
      results.incompleteTranslations.size > 0 ||
      results.keysWithSpaces.size > 0
    ) {
      console.error("❌ Translation validation failed!\n");
      console.error("   Please fix the issues above before committing.\n");

      if (results.missingKeys.size > 0) {
        console.error("   • Add missing keys to your translation files");
      }
      if (results.unusedKeys.size > 0) {
        console.error("   • Remove unused keys from translation files");
      }
      if (results.keysWithSpaces.size > 0) {
        console.error("   • Remove spaces from translation keys (use underscores or camelCase instead)");
      }
      if (results.incompleteTranslations.size > 0) {
        console.error("   • Run 'pnpm generate-translations' to complete translations");
        console.error("   • Or manually add missing keys to target language files");
      }
      console.error();
      process.exit(1);
    }

    console.log("✅ Translation validation passed!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during validation:\n");
    console.error(`   ${error}\n`);
    process.exit(1);
  }
}

// Run the script
main();
