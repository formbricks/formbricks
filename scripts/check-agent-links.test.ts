import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { findAgentLinks } from "./check-agent-links.mjs";

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "check-agent-links.mjs");

const runCli = (input: string): { status: number; stderr: string } => {
  try {
    execFileSync("node", [SCRIPT], { input, stdio: ["pipe", "pipe", "pipe"] });
    return { status: 0, stderr: "" };
  } catch (error) {
    const { status, stderr } = error as { status: number; stderr: Buffer };
    return { status, stderr: stderr.toString() };
  }
};

describe("findAgentLinks", () => {
  test.each([
    [
      "a Claude Code session URL",
      "See https://claude.ai/code/session_011ABC for context",
      "Claude Code session link",
    ],
    [
      "a Claude-Session trailer",
      "fix: thing\n\nClaude-Session: https://example.com/x",
      "Claude-Session trailer",
    ],
    ["an indented trailer", "body\n  claude-session: abc", "Claude-Session trailer"],
    ["a ChatGPT share link", "https://chatgpt.com/share/abc-123", "ChatGPT or Codex conversation link"],
    ["a Codex task link", "https://chatgpt.com/codex/tasks/task_e_123", "ChatGPT or Codex conversation link"],
    ["a legacy ChatGPT share link", "https://chat.openai.com/share/abc", "ChatGPT share link"],
  ])("flags %s", (_name, text, label) => {
    expect(findAgentLinks(text)).toEqual([label]);
  });

  test.each([
    ["the attribution the repo keeps", "fix: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"],
    ["the Claude Code product link", "Generated with [Claude Code](https://claude.com/claude-code)"],
    ["a sentence naming the trailer mid-line", "Drop the Claude-Session: trailer before pushing."],
    ["a claude.ai artifact link", "https://claude.ai/artifact/abc"],
    [
      "the PR template's guidance, which names the shape",
      "Never an agent session or conversation link (`claude.ai/code/session_…`, Codex, Cursor, ChatGPT share links)",
    ],
  ])("passes %s", (_name, text) => {
    expect(findAgentLinks(text)).toEqual([]);
  });
});

describe("check-agent-links CLI", () => {
  test("exits 1 and names the link when stdin carries one", () => {
    const { status, stderr } = runCli("feat: y\n\nClaude-Session: https://claude.ai/code/session_1\n");
    expect(status).toBe(1);
    expect(stderr).toContain("Claude Code session link");
    expect(stderr).toContain("Claude-Session trailer");
  });

  test("exits 0 on a clean message", () => {
    expect(runCli("feat: y\n\nCo-Authored-By: Someone <a@b.c>\n").status).toBe(0);
  });
});
