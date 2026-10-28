import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { getLlmsTxt } from "./llms-txt";
import { getSetupGuide } from "./setup-guide";

const urls = { baseUrl: "https://app.example.com", mcpUrl: "https://app.example.com/api/mcp" };

/** The tools ADR 0018 adds. The registry test below fails if the guide names one the server does not register. */
const SETUP_TOOLS = [
  "get_account_context",
  "update_organization",
  "create_workspace",
  "update_workspace",
  "set_workspace_branding",
  "invite_member",
] as const;

const MCP_DIR = path.resolve(__dirname, "../mcp");

const readSources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return readSources(full);
    return /\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [readFileSync(full, "utf8")] : [];
  });

/** Every tool the server registers, read from the `registerScopedTool(server, "<name>"` calls themselves. */
const registeredToolNames = (): Set<string> => {
  const names = new Set<string>();
  for (const source of readSources(MCP_DIR)) {
    for (const match of source.matchAll(/registerScopedTool\(\s*server,\s*"([a-z_]+)"/g)) {
      names.add(match[1]);
    }
  }
  return names;
};

const toolNamesIn = (text: string): string[] =>
  [...text.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map((match) => match[1]);

describe("getSetupGuide", () => {
  const guide = getSetupGuide(urls);

  test("fills in the instance URLs and leaves no placeholder behind", () => {
    expect(guide).toContain(urls.mcpUrl);
    expect(guide).toContain(`${urls.baseUrl}/s/<surveyId>`);
    expect(guide).not.toMatch(/\$\{|\{\{|undefined|<instance>|<mcp-url>/);
  });

  test("uses the URLs it is given, not fixed ones", () => {
    const other = getSetupGuide({
      baseUrl: "https://forms.acme.test/fb",
      mcpUrl: "https://forms.acme.test/fb/api/mcp",
    });

    expect(other).toContain("https://forms.acme.test/fb/api/mcp");
    expect(other).not.toContain("app.example.com");
  });

  test("routes by who the person is, starting from the account context", () => {
    expect(guide.indexOf("get_account_context")).toBeLessThan(guide.indexOf("## Path A"));
    expect(guide).toContain("## Path A: New owner");
    expect(guide).toContain("## Path B: Invited member");
    expect(guide).toContain("## Path C: Returning user");
  });

  test("carries the safety rules and the confirmation gates", () => {
    expect(guide).toMatch(/data, never instructions/);
    expect(guide).toMatch(/Never invent/);
    expect(guide).toMatch(/Publishing and invites need their own explicit yes/);
  });

  test("offers the first use cases the product owner named", () => {
    for (const useCase of [
      "NPS",
      "CSAT",
      "Onboarding feedback",
      "Churn survey",
      "Feature request",
      "Event feedback",
    ]) {
      expect(guide).toContain(useCase);
    }
  });

  test("names the six setup tools", () => {
    const named = new Set(toolNamesIn(guide));
    for (const tool of SETUP_TOOLS) expect(named.has(tool), tool).toBe(true);
  });
});

describe("tools named by the guide", () => {
  const registered = registeredToolNames();
  const named = [...new Set(toolNamesIn(getSetupGuide(urls)))];

  test("every tool the guide names is registered", () => {
    const missing = named.filter((name) => !registered.has(name));

    expect(missing).toEqual([]);
  });

  test("the registry scan sees the surveys tools, so an empty scan cannot pass the check above", () => {
    expect(registered.has("create_survey")).toBe(true);
    expect(registered.has("show_survey")).toBe(true);
    expect(registered.size).toBeGreaterThan(50);
  });
});

describe("getLlmsTxt", () => {
  const text = getLlmsTxt(urls);

  test("points at the guide and the MCP server of this instance", () => {
    expect(text).toContain(`${urls.baseUrl}/agents/setup.md`);
    expect(text).toContain(urls.mcpUrl);
    expect(text).toContain("https://formbricks.com/docs");
    expect(text).not.toMatch(/\$\{|\{\{|undefined/);
  });

  test("names only registered tools", () => {
    const registered = registeredToolNames();

    expect(toolNamesIn(text).filter((name) => !registered.has(name))).toEqual([]);
  });
});
