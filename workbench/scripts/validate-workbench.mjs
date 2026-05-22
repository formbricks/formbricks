#!/usr/bin/env node
/**
 * Validate the workbench structure, required sections, links, review gates, and known placeholders.
 *
 * Run from the repository root:
 *   node workbench/scripts/validate-workbench.mjs workbench
 *
 * Run from inside workbench/:
 *   node scripts/validate-workbench.mjs .
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

const reviewLinePattern = /^- \[[ xX]\] Reviewed and refined by: (?!TBD\s*$).+/m;
const reviewPlaceholderPattern = /^- \[ \] Reviewed and refined by: TBD\s*$/m;

const requiredFiles = [
  "GUIDE.md",
  "README.md",
  "blueprint/PRODUCT.md",
  "blueprint/EPICS.md",
  "blueprint/MILESTONES.md",
  "blueprint/CHECKS.md",
  "blueprint/MANUAL_QA.md",
  "blueprint/ENV_VARS.md",
  "blueprint/SECURITY.md",
  "cowork/BUG_FIXES.md",
  "cowork/COORDINATOR.md",
  "cowork/templates/BUG_FIX.md",
  "cowork/templates/BUSINESS_RULE.md",
  "cowork/templates/DECISION.md",
  "cowork/templates/MILESTONE.md",
  "cowork/templates/PLAN.md",
  "cowork/templates/PLAN_CHECKPOINT.md",
];

const requiredDirs = [
  "blueprint/business-rules",
  "blueprint/decisions",
  "blueprint/epics",
  "blueprint/guidelines",
  "blueprint/milestones",
  "cowork/bug-fixes",
  "cowork/checkpoints",
  "cowork/plans",
  "cowork/prompts",
  "cowork/templates",
  "research/docs",
  "research/images",
  "research/workflows-proto-logic",
  "scripts",
];

const planRequiredSections = [
  "## Goal",
  "## Definition of Done",
  "## Out of Scope",
  "## Phases",
  "## Test and Validation Plan",
  "## Manual QA Impact",
  "## Changelog Impact",
  "## Circuit Breakers",
  "## Risk Notes",
  "## Decision-Record Check",
  "## Final Review",
];

const checkpointRequiredSections = [
  "## Summary",
  "## Files Changed",
  "## Checks Run",
  "## Notes and Surprises",
  "## Implications",
  "## Follow-Ups",
];

const changelogCategories = new Set([
  "Added",
  "Changed",
  "Fixed",
  "Removed",
  "Security",
  "Operations",
  "QA / Verification",
  "None",
  "TBD",
]);

const findings = [];

function add(severity, message, path) {
  findings.push({ severity, message, path });
}

function rel(root, file) {
  return relative(root, file) || ".";
}

function readIfExists(file) {
  return existsSync(file) ? readFileSync(file, "utf8") : null;
}

function listMarkdown(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => join(dir, file))
    .sort();
}

function walkMarkdown(dir) {
  if (!existsSync(dir)) return [];
  const files = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkMarkdown(file));
    if (entry.isFile() && entry.name.endsWith(".md")) files.push(file);
  }

  return files.sort();
}

function extractMarkdownLinks(content) {
  const links = [];

  for (let index = 0; index < content.length; index++) {
    if (content[index] !== "]" || content[index + 1] !== "(") continue;

    const start = index + 2;
    let end = -1;

    if (content[start] === "<") {
      end = content.indexOf(">", start + 1);
      if (end !== -1) links.push(content.slice(start + 1, end));
      continue;
    }

    let depth = 0;
    for (let cursor = start; cursor < content.length; cursor++) {
      const char = content[cursor];
      if (char === "(") depth++;
      if (char === ")") {
        if (depth === 0) {
          end = cursor;
          break;
        }
        depth--;
      }
    }

    if (end !== -1) links.push(content.slice(start, end));
  }

  return links
    .map((target) => target.trim().split("#")[0])
    .filter((target) => target && !/^(https?:|mailto:|app:\/\/|#)/.test(target));
}

function checkRequired(root) {
  for (const dir of requiredDirs) {
    const file = join(root, dir);
    if (!existsSync(file) || !statSync(file).isDirectory()) add("FAIL", "Missing required directory", dir);
  }

  for (const requiredFile of requiredFiles) {
    const file = join(root, requiredFile);
    if (!existsSync(file) || !statSync(file).isFile()) add("FAIL", "Missing required file", requiredFile);
  }
}

function checkLocalLinks(root) {
  for (const file of walkMarkdown(root)) {
    const content = readIfExists(file) ?? "";

    for (const target of extractMarkdownLinks(content)) {
      const targetPath = resolve(dirname(file), target);
      if (!targetPath.startsWith(root)) continue;
      if (!existsSync(targetPath)) add("FAIL", `Broken local link to ${target}`, rel(root, file));
    }
  }
}

function checkStalePaths(root) {
  const stalePatterns = [
    "workbench/cowork/GUIDE.md",
    "workbench/cowork/MILESTONES.md",
    "workbench/cowork/COORDINATION.md",
    "workbench/cowork/milestones",
    "workbench/cowork/research",
    "workbench/guidelines",
    "workbench/prompts",
    "workbench/blueprint/diagrams.md",
    "workbench/research/initial-prototype-logic",
    "packages/hub/",
  ];

  for (const file of walkMarkdown(root)) {
    const content = readIfExists(file) ?? "";
    for (const pattern of stalePatterns) {
      if (content.includes(pattern)) add("FAIL", `Stale moved path reference: ${pattern}`, rel(root, file));
    }
  }
}

function checkReviewLine(root, file, severity) {
  const content = readIfExists(file) ?? "";
  if (reviewLinePattern.test(content)) return;

  if (reviewPlaceholderPattern.test(content)) {
    add(severity, "Review gate is still TBD", rel(root, file));
    return;
  }

  add(severity, "Missing review gate: - [ ] Reviewed and refined by: TBD", rel(root, file));
}

function checkTemplates(root) {
  for (const template of [
    "cowork/templates/BUG_FIX.md",
    "cowork/templates/BUSINESS_RULE.md",
    "cowork/templates/DECISION.md",
    "cowork/templates/MILESTONE.md",
    "cowork/templates/PLAN.md",
    "cowork/templates/PLAN_CHECKPOINT.md",
  ]) {
    const file = join(root, template);
    if (existsSync(file) && !reviewPlaceholderPattern.test(readIfExists(file) ?? "")) {
      add("FAIL", "Template must end with review gate placeholder", template);
    }
  }
}

function getStatus(content) {
  const tableMatch = content.match(/^\|\s*Status\s*\|\s*([^|]+?)\s*\|/m);
  if (tableMatch) return tableMatch[1].trim();

  const boldMatch = content.match(/^\*\*Status\*\*:\s*(.+)$/m);
  return boldMatch?.[1]?.trim();
}

function checkChangelogImpact(root, file) {
  const content = readIfExists(file) ?? "";
  const categoryMatch = content.match(/^Category:\s*(.+)$/m);

  if (!content.includes("## Changelog Impact")) {
    add("WARN", "Missing Changelog Impact section", rel(root, file));
    return;
  }

  if (!categoryMatch) {
    add("WARN", "Changelog Impact has no Category line", rel(root, file));
    return;
  }

  const category = categoryMatch[1].trim();
  if (!changelogCategories.has(category)) {
    add("FAIL", `Invalid Changelog Impact category "${category}"`, rel(root, file));
  }
}

function checkPlans(root) {
  for (const file of listMarkdown(join(root, "cowork/plans"))) {
    const name = basename(file);
    const content = readIfExists(file) ?? "";

    if (!/^\d{3}-\d{3}-[a-z0-9][a-z0-9-]*\.md$/.test(name)) {
      add("FAIL", "Plan filename should match MMM-PPP-slug.md", rel(root, file));
    }

    for (const section of planRequiredSections) {
      if (!content.includes(section)) add("FAIL", `Missing required plan section ${section}`, rel(root, file));
    }

    checkChangelogImpact(root, file);

    const status = getStatus(content);
    if (status === "Active" && !reviewLinePattern.test(content)) {
      add("FAIL", "Active plan must be reviewed by a human before implementation", rel(root, file));
    } else if (!reviewLinePattern.test(content)) {
      add("WARN", "Plan has no completed human review gate", rel(root, file));
    }
  }
}

function checkMilestones(root) {
  for (const file of listMarkdown(join(root, "blueprint/milestones"))) {
    const name = basename(file);
    const content = readIfExists(file) ?? "";

    if (!/^\d{3}-[a-z0-9][a-z0-9-]*\.md$/.test(name)) {
      add("FAIL", "Milestone filename should match NNN-slug.md", rel(root, file));
    }

    const status = getStatus(content);
    if ((status === "Active" || status === "Done") && !reviewLinePattern.test(content)) {
      add("FAIL", "Active or Done milestone must be reviewed by a human", rel(root, file));
    } else if (!reviewLinePattern.test(content)) {
      add("WARN", "Milestone has no completed human review gate", rel(root, file));
    }
  }
}

function checkBugFixes(root) {
  for (const file of listMarkdown(join(root, "cowork/bug-fixes"))) {
    const name = basename(file);
    const content = readIfExists(file) ?? "";

    if (name === ".gitkeep") continue;
    if (!/^\d{3}-[a-z0-9][a-z0-9-]*\.md$/.test(name)) {
      add("FAIL", "Bug-fix filename should match BBB-slug.md", rel(root, file));
    }

    checkChangelogImpact(root, file);

    const status = getStatus(content);
    if ((status === "Active" || status === "Done") && !reviewLinePattern.test(content)) {
      add("FAIL", "Active or Done bug fix must be reviewed by a human", rel(root, file));
    } else if (!reviewLinePattern.test(content)) {
      add("WARN", "Bug fix has no completed human review gate", rel(root, file));
    }
  }
}

function checkCheckpoints(root) {
  for (const file of listMarkdown(join(root, "cowork/checkpoints"))) {
    const name = basename(file);
    const content = readIfExists(file) ?? "";

    if (!/^\d{3}-\d{3}-[a-z0-9][a-z0-9-]*\.md$/.test(name)) {
      add("FAIL", "Checkpoint filename should match MMM-PPP-slug.md", rel(root, file));
    }

    for (const section of checkpointRequiredSections) {
      if (!content.includes(section)) add("WARN", `Missing checkpoint section ${section}`, rel(root, file));
    }
  }
}

function checkIndexes(root) {
  for (const file of [
    "blueprint/MILESTONES.md",
    "cowork/BUG_FIXES.md",
    "blueprint/EPICS.md",
    "blueprint/DESIGN.md",
  ]) {
    const fullPath = join(root, file);
    if (!existsSync(fullPath)) continue;
    const content = readIfExists(fullPath) ?? "";
    if (!content.trim() || content.includes("| TBD | TBD")) {
      add("INFO", "Index still contains placeholder rows", file);
    }
  }
}

function main() {
  const input = process.argv[2] ?? "workbench";
  const root = resolve(input);

  if (!existsSync(root) || !statSync(root).isDirectory()) {
    console.error(`FAIL ${input}: workbench root does not exist or is not a directory`);
    process.exit(1);
  }

  checkRequired(root);
  checkLocalLinks(root);
  checkStalePaths(root);
  checkTemplates(root);
  checkPlans(root);
  checkMilestones(root);
  checkBugFixes(root);
  checkCheckpoints(root);
  checkIndexes(root);

  const severityRank = { FAIL: 0, WARN: 1, INFO: 2 };
  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.path.localeCompare(b.path));

  for (const finding of findings) {
    console.log(`${finding.severity} ${finding.path}: ${finding.message}`);
  }

  const counts = findings.reduce(
    (acc, finding) => {
      acc[finding.severity.toLowerCase()] += 1;
      return acc;
    },
    { fail: 0, warn: 0, info: 0 }
  );

  console.log(`Summary: ${counts.fail} fail, ${counts.warn} warn, ${counts.info} info`);
  process.exit(counts.fail > 0 ? 1 : 0);
}

main();
