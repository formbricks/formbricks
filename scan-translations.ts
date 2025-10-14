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
 */

import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";

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

interface TranslationKeys {
    [key: string]: string | TranslationKeys;
}

interface ScanResults {
    usedKeys: Set<string>;
    translationKeys: Set<string>;
    missingKeys: string[];
    unusedKeys: string[];
    incompleteTranslations: Map<string, string[]>; // locale -> missing keys
}

/**
 * Recursively flatten nested translation keys
 * Example: { auth: { login: "Login" } } => ["auth.login"]
 */
function flattenKeys(obj: TranslationKeys, prefix: string = ""): string[] {
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
 * Extract translation keys from a file's content
 */
function extractKeysFromContent(content: string): string[] {
    const keys: string[] = [];

    for (const pattern of TRANSLATION_PATTERNS) {
        let match;
        // Reset lastIndex for global regex
        pattern.lastIndex = 0;

        while ((match = pattern.exec(content)) !== null) {
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
            const content = fs.readFileSync(file, "utf-8");
            const keys = extractKeysFromContent(content);

            keys.forEach(key => usedKeys.add(key));
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
function getLocaleFiles(): string[] {
    const files = fs.readdirSync(LOCALES_DIR);
    return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
}

/**
 * Load translation keys from a specific locale file
 */
function loadKeysFromLocale(locale: string): Set<string> {
    const localePath = path.join(LOCALES_DIR, `${locale}.json`);
    const translationKeys = new Set<string>();

    if (!fs.existsSync(localePath)) {
        throw new Error(`❌ Locale file not found: ${localePath}`);
    }

    try {
        const content = fs.readFileSync(localePath, "utf-8");
        const translations = JSON.parse(content);
        const keys = flattenKeys(translations);

        keys.forEach(key => translationKeys.add(key));

        return translationKeys;
    } catch (error) {
        throw new Error(`❌ Failed to parse ${localePath}: ${error}`);
    }
}

/**
 * Load translation keys from all locale files
 */
function loadAllTranslationKeys(): Map<string, Set<string>> {
    console.log("📚 Loading translation keys from locale files...\n");

    const allLocales = getLocaleFiles();
    const translationsByLocale = new Map<string, Set<string>>();

    for (const locale of allLocales) {
        const keys = loadKeysFromLocale(locale);
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
 * Compare used keys with translation keys to find missing and unused keys
 */
function compareKeys(
    usedKeys: Set<string>,
    translationKeys: Set<string>,
    translationsByLocale: Map<string, Set<string>>
): ScanResults {
    console.log("🔄 Comparing keys...\n");

    const missingKeys: string[] = [];
    const unusedKeys: string[] = [];

    // Find missing keys (used but not in translations)
    for (const key of usedKeys) {
        if (!translationKeys.has(key)) {
            missingKeys.push(key);
        }
    }

    // Find unused keys (in translations but not used)
    for (const key of translationKeys) {
        if (!usedKeys.has(key)) {
            unusedKeys.push(key);
        }
    }

    // Check for incomplete translations across locales
    const incompleteTranslations = checkIncompleteTranslations(translationsByLocale);

    return {
        usedKeys,
        translationKeys,
        missingKeys: missingKeys.sort(),
        unusedKeys: unusedKeys.sort(),
        incompleteTranslations,
    };
}

/**
 * Display validation results
 */
function displayResults(results: ScanResults): void {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("                    VALIDATION RESULTS                     ");
    console.log("═══════════════════════════════════════════════════════════\n");

    const hasIssues = results.missingKeys.length > 0 ||
        results.unusedKeys.length > 0 ||
        results.incompleteTranslations.size > 0;

    if (!hasIssues) {
        console.log("✅ All translation keys are valid!\n");
        console.log(`   • ${results.usedKeys.size} keys used in code`);
        console.log(`   • ${results.translationKeys.size} keys in translations`);
        console.log(`   • 0 missing keys`);
        console.log(`   • 0 unused keys`);
        console.log(`   • All locales complete\n`);
        return;
    }

    if (results.missingKeys.length > 0) {
        console.log(`❌ MISSING KEYS (${results.missingKeys.length}):\n`);
        console.log("   These keys are used in code but not found in translation files:\n");
        results.missingKeys.forEach(key => {
            console.log(`   • ${key}`);
        });
        console.log();
    }

    if (results.unusedKeys.length > 0) {
        console.log(`⚠️  UNUSED KEYS (${results.unusedKeys.length}):\n`);
        console.log("   These keys exist in translation files but are not used in code:\n");
        results.unusedKeys.forEach(key => {
            console.log(`   • ${key}`);
        });
        console.log();
    }

    if (results.incompleteTranslations.size > 0) {
        console.log(`⚠️  INCOMPLETE TRANSLATIONS:\n`);
        console.log(`   Some keys from ${DEFAULT_LOCALE} are missing in target languages:\n`);

        for (const [locale, missingKeys] of results.incompleteTranslations.entries()) {
            console.log(`   📝 ${locale} (${missingKeys.length} missing keys):`);

            // Show first 10 missing keys for each locale to avoid overwhelming output
            const keysToShow = missingKeys.slice(0, 10);
            keysToShow.forEach(key => {
                console.log(`      • ${key}`);
            });

            if (missingKeys.length > 10) {
                console.log(`      ... and ${missingKeys.length - 10} more`);
            }
            console.log();
        }
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
        const translationsByLocale = loadAllTranslationKeys();
        const defaultKeys = translationsByLocale.get(DEFAULT_LOCALE)!;

        // Compare and find issues
        const results = compareKeys(usedKeys, defaultKeys, translationsByLocale);

        // Display results
        displayResults(results);

        // Exit with error if validation failed
        if (results.missingKeys.length > 0 || results.unusedKeys.length > 0 || results.incompleteTranslations.size > 0) {
            console.error("❌ Translation validation failed!\n");
            console.error("   Please fix the issues above before committing.\n");

            if (results.missingKeys.length > 0) {
                console.error("   • Add missing keys to your translation files");
            }
            if (results.unusedKeys.length > 0) {
                console.error("   • Remove unused keys from translation files");
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

