#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const examplePath = path.join(repoRoot, ".env.example");
const envPath = path.join(repoRoot, ".env");

const generatedSecretKeys = ["ENCRYPTION_KEY", "NEXTAUTH_SECRET", "CRON_SECRET"];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseEnvValue = (rawValue) => {
  const trimmedStartValue = rawValue.trimStart();
  let normalizedValue = "";
  let inSingleQuotes = false;
  let inDoubleQuotes = false;

  for (const char of trimmedStartValue) {
    if (char === "'" && !inDoubleQuotes) {
      inSingleQuotes = !inSingleQuotes;
    } else if (char === '"' && !inSingleQuotes) {
      inDoubleQuotes = !inDoubleQuotes;
    } else if (char === "#" && !inSingleQuotes && !inDoubleQuotes) {
      break;
    }

    normalizedValue += char;
  }

  const trimmedValue = normalizedValue.trim();

  if (
    (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    return trimmedValue.slice(1, -1);
  }

  return trimmedValue;
};

const parseEnv = (content) => {
  const entries = new Map();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line
      .slice(0, separatorIndex)
      .trim()
      .replace(/^export\s+/, "");
    const value = parseEnvValue(line.slice(separatorIndex + 1));

    if (!key) {
      continue;
    }

    entries.set(key, value);
  }

  return entries;
};

const replaceOrAppendEnvValue = (content, key, value) => {
  const linePattern = new RegExp(`^(?:export\\s+)?${escapeRegExp(key)}\\s*=.*$`, "m");
  const nextLine = `${key}=${value}`;

  if (linePattern.test(content)) {
    return content.replace(linePattern, nextLine);
  }

  const normalizedContent = content.endsWith("\n") ? content : `${content}\n`;
  return `${normalizedContent}${nextLine}\n`;
};

const isValidEncryptionKey = (value) => value.length === 32 || /^[0-9a-fA-F]{64}$/.test(value);

const isMissingSecretValue = (key, value) => {
  if (!value) {
    return true;
  }

  if (key === "ENCRYPTION_KEY" && !isValidEncryptionKey(value)) {
    return true;
  }

  return false;
};

if (!existsSync(examplePath)) {
  console.error(`❌ Could not find template file at ${path.relative(repoRoot, examplePath)}.`);
  process.exit(1);
}

const exampleContent = readFileSync(examplePath, "utf8");
let envContent = existsSync(envPath) ? readFileSync(envPath, "utf8") : exampleContent;
const initialEnvExists = existsSync(envPath);
const parsedEnv = parseEnv(envContent);

const changedKeys = [];

for (const key of generatedSecretKeys) {
  const currentValue = parsedEnv.get(key);

  if (isMissingSecretValue(key, currentValue)) {
    const generatedValue = randomBytes(32).toString("hex");
    envContent = replaceOrAppendEnvValue(envContent, key, generatedValue);
    parsedEnv.set(key, generatedValue);
    changedKeys.push(key);
  }
}

if (!initialEnvExists || changedKeys.length > 0) {
  writeFileSync(envPath, envContent, "utf8");
}

const relativeEnvPath = path.relative(repoRoot, envPath);

if (!initialEnvExists) {
  console.log(`✅ Created ${relativeEnvPath} from .env.example.`);
} else {
  console.log(`ℹ️ Using existing ${relativeEnvPath}.`);
}

if (changedKeys.length > 0) {
  console.log(`🔐 Updated ${relativeEnvPath}: ${changedKeys.join(", ")}.`);
} else {
  console.log(`✅ ${relativeEnvPath} already has all required generated secrets.`);
}

console.log("🚀 Development environment file is ready.");
