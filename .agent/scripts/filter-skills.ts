#!/usr/bin/env tsx
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface FilterConfig {
  featureFlags: {
    keepCriticalPriority: boolean;
    keepHighPriority: boolean;
    keepMediumPriority: boolean;
    keepLowPriority: boolean;
    removeJsOptimizations: boolean;
    removeRenderingOptimizations: boolean;
    removeAdvancedPatterns: boolean;
  };
  priorities: {
    keep: string[];
    conditionalKeep: string[];
    remove: string[];
  };
  technologyDetection: Record<string, {
    packageNames: string[];
    codePatterns: string[];
    relatedRules: string[];
  }>;
  alwaysKeep: string[];
  alwaysRemove: string[];
}

interface FilterReport {
  kept: { file: string; reason: string }[];
  archived: { file: string; reason: string }[];
  technologiesDetected: string[];
  summary: {
    totalRules: number;
    keptRules: number;
    archivedRules: number;
    reductionPercent: number;
  };
}

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SKILLS_DIR = path.join(PROJECT_ROOT, '.agent/skills/react-best-practices');
const RULES_DIR = path.join(SKILLS_DIR, 'rules');
const ARCHIVE_DIR = path.join(SKILLS_DIR, '.archived');
const CONFIG_PATH = path.join(SKILLS_DIR, 'skill-filter-config.json');
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const validateOnly = args.includes('--validate-config');

function loadConfig(): FilterConfig {
  const configContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(configContent);
}

function validateConfig(config: FilterConfig): void {
  console.log('✓ Configuration is valid');
  console.log(`  - ${config.alwaysKeep.length} rules marked as always keep`);
  console.log(`  - ${config.alwaysRemove.length} rules marked as always remove`);
  console.log(`  - ${Object.keys(config.technologyDetection).length} technologies configured for detection`);
}

function detectTechnologies(config: FilterConfig): Set<string> {
  const detected = new Set<string>();
  
  // Check package.json dependencies
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  for (const [techName, techConfig] of Object.entries(config.technologyDetection)) {
    // Check for package dependencies
    const hasPackage = techConfig.packageNames.some(pkg => allDeps[pkg]);
    
    if (hasPackage) {
      detected.add(techName);
      continue;
    }

    // Check for code patterns using ripgrep
    if (techConfig.codePatterns.length > 0) {
      for (const pattern of techConfig.codePatterns) {
        try {
          // Use ripgrep to search for patterns in TypeScript/JavaScript files
          execSync(
            `rg -q '${pattern.replace(/'/g, "\\'")}' -g '*.ts' -g '*.tsx' -g '*.js' -g '*.jsx' "${PROJECT_ROOT}"`,
            { stdio: 'pipe' }
          );
          detected.add(techName);
          break;
        } catch (e) {
          // Pattern not found, continue checking
        }
      }
    }
  }

  return detected;
}

function getRulePriority(filename: string): string | null {
  const content = fs.readFileSync(path.join(RULES_DIR, filename), 'utf-8');
  const match = content.match(/impact:\s*([A-Z-]+)/);
  return match ? match[1] : null;
}

function checkFeatureFlagOverride(
  filename: string,
  flags: FilterConfig['featureFlags']
): { keep: boolean; reason: string } | null {
  if (flags.removeJsOptimizations && filename.startsWith('js-')) {
    return { keep: false, reason: 'Feature flag: removeJsOptimizations' };
  }
  if (flags.removeRenderingOptimizations && filename.startsWith('rendering-')) {
    return { keep: false, reason: 'Feature flag: removeRenderingOptimizations' };
  }
  if (flags.removeAdvancedPatterns && filename.startsWith('advanced-')) {
    return { keep: false, reason: 'Feature flag: removeAdvancedPatterns' };
  }
  return null;
}

function checkAlwaysKeepOrRemove(
  filename: string,
  config: FilterConfig
): { keep: boolean; reason: string } | null {
  if (config.alwaysKeep.includes(filename)) {
    return { keep: true, reason: 'Always keep (critical pattern)' };
  }
  if (config.alwaysRemove.includes(filename)) {
    return { keep: false, reason: 'Always remove (low priority optimization)' };
  }
  return null;
}

function checkTechnologyDetection(
  filename: string,
  config: FilterConfig,
  detectedTechnologies: Set<string>
): { keep: boolean; reason: string } | null {
  for (const [techName, techConfig] of Object.entries(config.technologyDetection)) {
    if (techConfig.relatedRules.includes(filename)) {
      if (detectedTechnologies.has(techName)) {
        return { keep: true, reason: `Technology detected: ${techName}` };
      } else {
        return { keep: false, reason: `Technology not used: ${techName}` };
      }
    }
  }
  return null;
}

function checkPriorityWithFlags(
  priority: string,
  flags: FilterConfig['featureFlags'],
  priorities: FilterConfig['priorities']
): { keep: boolean; reason: string } | null {
  // Check feature flag overrides
  if (priority === 'CRITICAL' && !flags.keepCriticalPriority) {
    return { keep: false, reason: 'Feature flag: keepCriticalPriority disabled' };
  }
  if (priority === 'HIGH' && !flags.keepHighPriority) {
    return { keep: false, reason: 'Feature flag: keepHighPriority disabled' };
  }
  if ((priority === 'MEDIUM' || priority === 'MEDIUM-HIGH') && !flags.keepMediumPriority) {
    return { keep: false, reason: 'Feature flag: keepMediumPriority disabled' };
  }
  if ((priority === 'LOW' || priority === 'LOW-MEDIUM') && flags.keepLowPriority) {
    return { keep: true, reason: 'Feature flag: keepLowPriority enabled' };
  }

  // Check priority configuration
  if (priorities.keep.includes(priority)) {
    return { keep: true, reason: `Priority: ${priority}` };
  }
  if (priorities.conditionalKeep.includes(priority)) {
    return { keep: true, reason: `Priority: ${priority} (conditional keep)` };
  }
  if (priorities.remove.includes(priority)) {
    return { keep: false, reason: `Priority: ${priority}` };
  }

  return null;
}

function shouldKeepRule(
  filename: string,
  config: FilterConfig,
  detectedTechnologies: Set<string>
): { keep: boolean; reason: string } {
  const flags = config.featureFlags;

  // Check feature flag overrides first
  const flagOverride = checkFeatureFlagOverride(filename, flags);
  if (flagOverride) return flagOverride;

  // Check always keep/remove lists
  const alwaysRule = checkAlwaysKeepOrRemove(filename, config);
  if (alwaysRule) return alwaysRule;

  // Check technology detection
  const techRule = checkTechnologyDetection(filename, config, detectedTechnologies);
  if (techRule) return techRule;

  // Check priority with feature flags
  const priority = getRulePriority(filename);
  if (priority) {
    const priorityRule = checkPriorityWithFlags(priority, flags, config.priorities);
    if (priorityRule) return priorityRule;
  }

  // Default: keep if uncertain
  return { keep: true, reason: 'Default (no matching rule)' };
}

function filterRules(config: FilterConfig, detectedTechnologies: Set<string>): FilterReport {
  const report: FilterReport = {
    kept: [],
    archived: [],
    technologiesDetected: Array.from(detectedTechnologies),
    summary: {
      totalRules: 0,
      keptRules: 0,
      archivedRules: 0,
      reductionPercent: 0,
    },
  };

  const ruleFiles = fs.readdirSync(RULES_DIR).filter(f => f.endsWith('.md'));
  report.summary.totalRules = ruleFiles.length;

  for (const filename of ruleFiles) {
    const decision = shouldKeepRule(filename, config, detectedTechnologies);
    
    if (decision.keep) {
      report.kept.push({ file: filename, reason: decision.reason });
      report.summary.keptRules++;
    } else {
      report.archived.push({ file: filename, reason: decision.reason });
      report.summary.archivedRules++;
      
      if (!isDryRun) {
        // Move to archive
        const sourcePath = path.join(RULES_DIR, filename);
        const archivePath = path.join(ARCHIVE_DIR, filename);
        fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
        fs.renameSync(sourcePath, archivePath);
      }
    }
  }

  report.summary.reductionPercent = Math.round(
    (report.summary.archivedRules / report.summary.totalRules) * 100
  );

  return report;
}

function printReport(report: FilterReport): void {
  console.log('\n' + '='.repeat(80));
  console.log('SKILL FILTER REPORT');
  console.log('='.repeat(80) + '\n');

  console.log('📊 SUMMARY');
  console.log(`   Total rules: ${report.summary.totalRules}`);
  console.log(`   Kept: ${report.summary.keptRules} (${100 - report.summary.reductionPercent}%)`);
  console.log(`   Archived: ${report.summary.archivedRules} (${report.summary.reductionPercent}%)`);
  console.log('');

  console.log('🔍 TECHNOLOGIES DETECTED');
  if (report.technologiesDetected.length > 0) {
    report.technologiesDetected.forEach(tech => console.log(`   ✓ ${tech}`));
  } else {
    console.log('   (none detected)');
  }
  console.log('');

  console.log('✅ KEPT RULES (' + report.kept.length + ')');
  report.kept.forEach(({ file, reason }) => {
    console.log(`   • ${file.padEnd(45)} → ${reason}`);
  });
  console.log('');

  console.log('📦 ARCHIVED RULES (' + report.archived.length + ')');
  report.archived.forEach(({ file, reason }) => {
    console.log(`   • ${file.padEnd(45)} → ${reason}`);
  });
  console.log('');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No files were modified');
  } else {
    console.log('✨ Filtering complete! Archived rules moved to .archived/');
  }
  console.log('');
}

function saveReport(report: FilterReport): void {
  const reportPath = path.join(SKILLS_DIR, 'filter-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📝 Report saved to: ${reportPath}`);
}

function fetchSkills(): void {
  console.log('📥 Fetching Vercel React best practices from GitHub...\n');
  
  const tempDir = path.join(PROJECT_ROOT, '.agent/.temp-skills');
  const tarballUrl = 'https://github.com/vercel-labs/agent-skills/archive/refs/heads/main.tar.gz';
  
  try {
    // Clean up temp directory if it exists
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    
    console.log('  → Downloading tarball from GitHub...');
    // Download and extract the entire repo first
    execSync(
      `curl -sL ${tarballUrl} | tar -xz -C "${tempDir}"`,
      { stdio: 'pipe' }
    );
    
    // Find the extracted directory and move the skills subdirectory
    const extractedDir = path.join(tempDir, 'agent-skills-main/skills/react-best-practices');
    
    if (!fs.existsSync(extractedDir)) {
      throw new Error(`Skills directory not found in tarball: ${extractedDir}`);
    }
    
    // Move to final location
    if (fs.existsSync(SKILLS_DIR)) {
      console.log('  → Removing old skills...');
      fs.rmSync(SKILLS_DIR, { recursive: true, force: true });
    }
    
    console.log('  → Installing to .agent/skills/...');
    fs.mkdirSync(path.dirname(SKILLS_DIR), { recursive: true });
    fs.renameSync(extractedDir, SKILLS_DIR);
    
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    // Create default config file if it doesn't exist
    if (!fs.existsSync(CONFIG_PATH)) {
      const defaultConfig = {
        featureFlags: {
          keepCriticalPriority: true,
          keepHighPriority: true,
          keepMediumPriority: true,
          keepLowPriority: false,
          removeJsOptimizations: true,
          removeRenderingOptimizations: true,
          removeAdvancedPatterns: true
        },
        priorities: {
          keep: ["CRITICAL", "HIGH"],
          conditionalKeep: ["MEDIUM", "MEDIUM-HIGH"],
          remove: ["LOW", "LOW-MEDIUM"]
        },
        technologyDetection: {},
        alwaysKeep: [
          "async-defer-await.md",
          "async-parallel.md",
          "async-dependencies.md",
          "async-api-routes.md",
          "bundle-barrel-imports.md",
          "bundle-dynamic-imports.md",
          "bundle-defer-third-party.md",
          "bundle-conditional.md",
          "bundle-preload.md",
          "rerender-functional-setstate.md",
          "rerender-memo.md",
          "rerender-dependencies.md",
          "rerender-defer-reads.md"
        ],
        alwaysRemove: [
          "js-batch-dom-css.md",
          "js-cache-property-access.md",
          "js-combine-iterations.md",
          "js-early-exit.md",
          "js-hoist-regexp.md",
          "js-index-maps.md",
          "js-length-check-first.md",
          "js-min-max-loop.md",
          "js-set-map-lookups.md",
          "js-tosorted-immutable.md",
          "js-cache-function-results.md",
          "rendering-activity.md",
          "rendering-animate-svg-wrapper.md",
          "rendering-conditional-render.md",
          "rendering-content-visibility.md",
          "rendering-hoist-jsx.md",
          "rendering-hydration-no-flicker.md",
          "rendering-svg-precision.md",
          "advanced-event-handler-refs.md",
          "advanced-use-latest.md"
        ]
      };
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
    }
    
    console.log('✓ Skills fetched successfully\n');
  } catch (error) {
    console.error('❌ Failed to fetch skills:', error);
    // Clean up on error
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    throw error;
  }
}

function formatSkills(): void {
  console.log('🎨 Formatting skill files to match project code style...\n');
  try {
    execSync(
      `prettier --write "${SKILLS_DIR}/**/*.md"`,
      { stdio: 'inherit', cwd: PROJECT_ROOT }
    );
    console.log('✓ Formatting complete\n');
  } catch (error) {
    console.log('⚠️  Formatting failed (non-critical):', error);
  }
}

// Main execution
try {
  const args = process.argv.slice(2);
  const shouldFetch = args.includes('--fetch') || !fs.existsSync(SKILLS_DIR);
  
  // Auto-fetch if skills don't exist
  if (shouldFetch) {
    fetchSkills();
  }
  
  // Check if skills exist after potential fetch
  if (!fs.existsSync(SKILLS_DIR)) {
    console.error('❌ Skills directory not found!\n');
    console.error('Please run with --fetch flag:');
    console.error('  pnpm filter-skills --fetch\n');
    process.exit(1);
  }

  const validateOnly = args.includes('--validate-config');

  const config = loadConfig();

  if (validateOnly) {
    validateConfig(config);
    process.exit(0);
  }

  console.log('🔍 Detecting technologies used in codebase...\n');
  const detectedTechnologies = detectTechnologies(config);

  console.log('🎯 Filtering skills...\n');
  const report = filterRules(config, detectedTechnologies);

  printReport(report);
  
  if (!isDryRun) {
    saveReport(report);
    formatSkills();
  }

  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
