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

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    entries.set(key, value);
  }

  return entries;
};

const replaceOrAppendEnvValue = (content, key, value) => {
  const linePattern = new RegExp(`^${key}=.*$`, "m");
  const nextLine = `${key}=${value}`;

  if (linePattern.test(content)) {
    return content.replace(linePattern, nextLine);
  }

  const normalizedContent = content.endsWith("\n") ? content : `${content}\n`;
  return `${normalizedContent}${nextLine}\n`;
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

  if (!currentValue) {
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
  console.log(`🔐 Generated missing secrets: ${changedKeys.join(", ")}.`);
} else {
  console.log("✅ All required generated secrets are already set.");
}

console.log("🚀 Development environment file is ready.");
