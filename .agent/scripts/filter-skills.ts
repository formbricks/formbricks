#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

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
const CONFIG_PATH = path.join(PROJECT_ROOT, '.agent/skill-filter-config.json');
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');

// Parse command line arguments
const args = new Set(process.argv.slice(2));
const isDryRun = args.has('--dry-run');

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

function hasRipgrep(): boolean {
  try {
    execSync('rg --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function detectTechnologies(config: FilterConfig): Set<string> {
  const detected = new Set<string>();
  
  // Check package.json dependencies
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const hasRg = hasRipgrep();
  if (!hasRg && Object.keys(config.technologyDetection).some(t => config.technologyDetection[t].codePatterns.length > 0)) {
    console.warn('⚠️  Ripgrep (rg) not found. Code pattern detection will be skipped.');
  }

  for (const [techName, techConfig] of Object.entries(config.technologyDetection)) {
    // Check for package dependencies
    const hasPackage = techConfig.packageNames.some(pkg => allDeps[pkg]);
    
    if (hasPackage) {
      detected.add(techName);
      continue;
    }

    // Check for code patterns using ripgrep
    if (hasRg && techConfig.codePatterns.length > 0) {
      for (const pattern of techConfig.codePatterns) {
        try {
          // Use ripgrep to search for patterns in TypeScript/JavaScript files
          // Use String.raw to avoid escaping issues, though redundant with single quotes in shell
           execSync(
            `rg -q '${pattern.replace(/'/g, "\\'")}' -g '*.ts' -g '*.tsx' -g '*.js' -g '*.jsx' "${PROJECT_ROOT}"`,
            { stdio: 'ignore' }
          );
          detected.add(techName);
          break;
        } catch {
          // Pattern not found or error, continue checking
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

function shouldKeepRule(
  filename: string,
  config: FilterConfig,
  detectedTechnologies: Set<string>
): { keep: boolean; reason: string } {
  const flags = config.featureFlags;

  // 1. Check feature flag naming conventions (hardcoded optimization flags)
  if (flags.removeJsOptimizations && filename.startsWith('js-')) {
    return { keep: false, reason: 'Feature flag: removeJsOptimizations' };
  }
  if (flags.removeRenderingOptimizations && filename.startsWith('rendering-')) {
    return { keep: false, reason: 'Feature flag: removeRenderingOptimizations' };
  }
  if (flags.removeAdvancedPatterns && filename.startsWith('advanced-')) {
    return { keep: false, reason: 'Feature flag: removeAdvancedPatterns' };
  }

  // 2. Check always keep/remove lists
  if (config.alwaysKeep.includes(filename)) {
    return { keep: true, reason: 'Always keep (critical pattern)' };
  }
  if (config.alwaysRemove.includes(filename)) {
    return { keep: false, reason: 'Always remove (low priority optimization)' };
  }

  // 3. Check technology detection
  for (const [techName, techConfig] of Object.entries(config.technologyDetection)) {
    if (techConfig.relatedRules.includes(filename)) {
      if (detectedTechnologies.has(techName)) {
        return { keep: true, reason: `Technology detected: ${techName}` };
      } else {
        return { keep: false, reason: `Technology not used: ${techName}` };
      }
    }
  }

  // 4. Check priority
  const priority = getRulePriority(filename);
  if (priority) {
    // Feature flag overrides for priorities
    if (priority === 'CRITICAL' && !flags.keepCriticalPriority) return { keep: false, reason: 'Feature flag: keepCriticalPriority disabled' };
    if (priority === 'HIGH' && !flags.keepHighPriority) return { keep: false, reason: 'Feature flag: keepHighPriority disabled' };
    if ((priority === 'MEDIUM' || priority === 'MEDIUM-HIGH') && !flags.keepMediumPriority) return { keep: false, reason: 'Feature flag: keepMediumPriority disabled' };
    if ((priority === 'LOW' || priority === 'LOW-MEDIUM') && flags.keepLowPriority) return { keep: true, reason: 'Feature flag: keepLowPriority enabled' };

    // Standard priority lists
    if (config.priorities.keep.includes(priority)) return { keep: true, reason: `Priority: ${priority}` };
    if (config.priorities.conditionalKeep.includes(priority)) return { keep: true, reason: `Priority: ${priority} (conditional keep)` };
    if (config.priorities.remove.includes(priority)) return { keep: false, reason: `Priority: ${priority}` };
  }

  // Default
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
    report.summary.totalRules > 0 
      ? (report.summary.archivedRules / report.summary.totalRules) * 100 
      : 0
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
  
  // Use os.tmpdir() for safer temp directory
  const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-'));
  const tarballUrl = 'https://github.com/vercel-labs/agent-skills/archive/refs/heads/main.tar.gz';
  
  try {
    console.log('  → Downloading tarball from GitHub...');
    // Download and extract the entire repo first
    try {
      execSync(
        `curl -sL ${tarballUrl} | tar -xz -C "${tempBase}"`,
        { stdio: 'pipe' }
      );
    } catch (e) {
      throw new Error('Failed to download skills. Check your internet connection or curl availability.');
    }
    
    // Find the extracted directory and move the skills subdirectory
    const extractedDir = path.join(tempBase, 'agent-skills-main/skills/react-best-practices');
    
    if (!fs.existsSync(extractedDir)) {
      throw new Error(`Skills directory not found in downloaded content: ${extractedDir}`);
    }
    
    // Move to final location
    if (fs.existsSync(SKILLS_DIR)) {
      console.log('  → Removing old skills...');
      fs.rmSync(SKILLS_DIR, { recursive: true, force: true });
    }
    
    console.log('  → Installing to .agent/skills/...');
    fs.mkdirSync(path.dirname(SKILLS_DIR), { recursive: true });
    fs.renameSync(extractedDir, SKILLS_DIR);
    
    // Create default config file if it doesn't exist AND not present in the new location
    // Note: We moved the config out, so we don't need to recreate it inside SKILLS_DIR
    // But if the external one is missing, we could offer to create it? 
    // For now, let's keep the logic simple and rely on the external config.
    if (!fs.existsSync(CONFIG_PATH)) {
       console.log('⚠️  Config file missing at new location. Creating default...');
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
  } finally {
    // Always clean up temp directory
    try {
      fs.rmSync(tempBase, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
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
  const shouldFetch = args.has('--fetch') || !fs.existsSync(SKILLS_DIR);
  
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

  const validateOnly = args.has('--validate-config');

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
