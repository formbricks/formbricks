#!/usr/bin/env node
// Rejects agent session and conversation links in commit messages and PR bodies (AGENTS.md).
//
// This repo is public, and a session transcript can hold customer data, internal context and
// credentials. The prose rule alone did not hold: agent harnesses append these links as attribution
// on every turn, later and more specifically than AGENTS.md, so links kept reaching PR bodies after
// the rule landed. Two callers run this check:
//
//   - `.husky/commit-msg` passes the commit message file, so a commit is refused locally.
//   - The `agent-links` job in `.github/workflows/pr.yml` pipes the PR body and every commit message
//     of the PR, so a commit made with hooks off or edited on GitHub is still caught.
//
// Usage: `node scripts/check-agent-links.mjs [file ...]`; with no file, reads stdin.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Each pattern names one kind of link; the label is what the error message prints. */
export const AGENT_LINK_PATTERNS = [
  // An id must follow `session_`, so prose naming the shape (`session_…` in AGENTS.md and the PR
  // template's guidance comment) does not match.
  { label: "Claude Code session link", pattern: /claude\.ai\/code\/session_[A-Za-z0-9]/i },
  { label: "Claude-Session trailer", pattern: /^\s*Claude-Session:/im },
  { label: "ChatGPT or Codex conversation link", pattern: /chatgpt\.com\/(?:share|c|codex\/tasks)\//i },
  { label: "ChatGPT share link", pattern: /chat\.openai\.com\/share\//i },
];

/** The labels of every agent link the text contains, in pattern order. */
export const findAgentLinks = (text) =>
  AGENT_LINK_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);

const readInputs = (paths) =>
  paths.length === 0
    ? [{ name: "stdin", text: readFileSync(0, "utf8") }]
    : paths.map((path) => ({ name: path, text: readFileSync(path, "utf8") }));

const main = () => {
  const failures = readInputs(process.argv.slice(2)).flatMap(({ name, text }) =>
    findAgentLinks(text).map((label) => `${name}: contains a ${label}`)
  );
  if (failures.length === 0) return;

  console.error(failures.join("\n"));
  console.error(
    "\nAgent session and conversation links are not allowed in this public repo (AGENTS.md):" +
      " transcripts can hold customer data and credentials. Remove the link or trailer; keep the" +
      " model note and the Co-Authored-By trailer."
  );
  process.exitCode = 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
