# Skill Filter

Automatically filters Vercel React best practices to reduce AI token costs while keeping high-impact performance patterns.

## Quick Start

```bash
# Fetch and filter (first time)
pnpm filter-skills --fetch

# Re-filter after config changes
pnpm filter-skills
```

**Result:** ~50% reduction in skill files (keeps CRITICAL/HIGH/MEDIUM priorities, removes LOW priority rules)

## Configuration

Edit `.agent/skills/react-best-practices/skill-filter-config.json`:

```json
{
  "featureFlags": {
    "keepCriticalPriority": true,    // async-*, bundle-*
    "keepHighPriority": true,        // server-*
    "keepMediumPriority": true,      // rerender-*
    "keepLowPriority": false,        // js-*, rendering-*, advanced-*
    "removeJsOptimizations": true,
    "removeRenderingOptimizations": true,
    "removeAdvancedPatterns": true
  }
}
```

**Toggle LOW priority rules:** Set `keepLowPriority: true`

## What It Does

1. Downloads latest skills from GitHub (with `--fetch`)
2. Filters based on priority and used technologies
3. Archives unused rules to `.archived/` (not tracked in git)
4. Formats markdown with Prettier to match project style

## Why This Works

- **AI Skills = Proactive:** Guide developers to write correct code from the start
- **Linting = Reactive:** Catch mistakes after code is written
- **Together:** AI prevents issues, linting catches what slips through

Token costs are an investment in preventing technical debt rather than fixing it later.

## Restore Archived Rules

```bash
mv .agent/skills/react-best-practices/.archived/rule-name.md \
   .agent/skills/react-best-practices/rules/
```

Then re-run: `pnpm filter-skills`

## Commands

```bash
pnpm filter-skills              # Filter with current config
pnpm filter-skills:dry-run      # Preview changes
pnpm filter-skills --fetch      # Fetch latest + filter
```

---

**Source:** [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)
