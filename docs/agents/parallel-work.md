# Parallel agents

Read this before splitting one change across several agents (a new package with several views, a
sweeping rename). Each rule is here because a run broke on it.

1. **The lead writes the shared code first.** Agents that each own a folder grow private copies of
   whatever they need: one build left eleven `isRecord`, four `plural`, six date formatters and two
   element-width hooks. Put `shared/` helpers (guards, formatting, plural, hooks) in place and tell
   agents to import them; a lint rule in the package should refuse the copies.
2. **Name every owned path and forbid the rest.** Shared files, locale files other than `en-US.json`,
   lockfiles and docs stay with the lead.
3. **Scoped commands only.** Whole-app `tsc` or `vitest` next to a Next.js build exhausts the 16 GB
   box. Say which commands each agent may run.
4. **Never let a scoped build clear a shared output.** `pnpm build -- --only=<view>` in
   `packages/mcp-views` adds one view and leaves the rest of `dist`; use `--out=dist-<name>` to isolate
   and delete the folder afterwards.
5. **Brief a slow job to wait.** An agent that starts a multi-minute build and is not told to poll it
   hands back "incomplete" repeatedly. Say "poll in the foreground; hand back only when it finishes or
   fails".
6. **Commit per agent, after its report.** A commit that mixes finished and in-flight files pushes a
   half-edited state. Stage each agent's owned paths and run the whole check once all are done.
7. **The report ends with a fact check.** Ask for the commands run and their counts; rerun the cheap
   ones yourself before committing.
