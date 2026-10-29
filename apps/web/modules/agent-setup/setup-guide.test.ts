import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { getLlmsTxt } from "./llms-txt";
import { getSetupGuide } from "./setup-guide";

const urls = { baseUrl: "https://app.example.com", mcpUrl: "https://app.example.com/api/mcp" };

/** The tools ADR 0018 adds. The registry test below fails if the guide names one the server does not register. */
const SETUP_TOOLS = [
  "get_account_context",
  "create_organization",
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

  describe("routing table", () => {
    const section = guide.slice(
      guide.indexOf("Then choose a path"),
      guide.indexOf("### The person wants another organization")
    );
    const rows = section
      .split("\n")
      .filter((line) => line.startsWith("|") && !/^\| (Role|---)/.test(line))
      .map((line) =>
        line
          .split("|")
          .map((cell) => cell.trim())
          .filter(Boolean)
      );

    test("has one row per case and each names a role set, a workspace condition and exactly one path", () => {
      expect(rows).toHaveLength(3);
      for (const [role, workspaces, path] of rows) {
        expect(role).toBeTruthy();
        expect(workspaces).toBeTruthy();
        expect(path).toMatch(/^\*\*[ABC]\. /);
      }
    });

    // The four facts the roles and workspace counts can combine into, each with the path that must answer it.
    const cases: Array<[string, "none" | "some", "A" | "B" | "C"]> = [
      ["owner", "none", "A"],
      ["manager", "none", "A"],
      ["owner", "some", "C"],
      ["manager", "some", "C"],
      ["member", "none", "B"],
      ["member", "some", "B"],
      ["billing", "none", "B"],
      ["billing", "some", "B"],
    ];
    const rowMatches = (role: string, workspaces: "none" | "some", [roleCell, workspaceCell]: string[]) => {
      const roleHit = roleCell.startsWith("owner or manager")
        ? role === "owner" || role === "manager"
        : !(role === "owner" || role === "manager");
      const workspaceHit = /none \(/.test(workspaceCell)
        ? workspaces === "none"
        : /one or more/.test(workspaceCell)
          ? workspaces === "some"
          : true;
      return roleHit && workspaceHit;
    };

    test.each(cases)("%s with %s workspace gets exactly one path: %s", (role, workspaces, expected) => {
      const hits = rows.filter((row) => rowMatches(role, workspaces, row));

      expect(hits).toHaveLength(1);
      expect(hits[0][2]).toContain(`**${expected}.`);
    });

    test("an owner or manager of an organization with no workspace is sent to the new-owner path, as a fact of role and count", () => {
      expect(section).toMatch(/manager of an organization that has no workspace takes Path A/);
      expect(section).toMatch(/`role` .* `workspaceCount`/);
    });

    test("no longer routes on how the person joined, which is not stored", () => {
      expect(guide).not.toMatch(/joinedAs|joined an existing organization by invitation/);
      expect(guide).toMatch(/never guess it from the role/);
    });
  });

  test("a member of an organization with no workspace is told to ask an owner or manager, and is not offered creation", () => {
    const pathB = guide.slice(guide.indexOf("## Path B"), guide.indexOf("## Path C"));

    expect(pathB).toMatch(/ask an organization owner or manager to create a workspace/);
    expect(pathB).toMatch(/Do not create one, and do not offer to/);
  });

  test("branding is read per workspace, never as an account-wide fact", () => {
    const pathA4 = guide.slice(guide.indexOf("### A4"), guide.indexOf("### A5"));

    expect(pathA4).toMatch(/its own `branding`/);
    expect(pathA4).toMatch(/`organizations\[\]\.workspaces\[\]`/);
    expect(guide).not.toMatch(/brandingSet|branding is set \(or not\)/);
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

  test("has a route for a person who wants another organization, ending in the new-owner path", () => {
    const section = guide.slice(
      guide.indexOf("### The person wants another organization"),
      guide.indexOf("## Path A")
    );

    expect(section).toContain("create_organization");
    expect(section).toContain("canCreateOrganization");
    expect(section).toMatch(/Path A: New owner/);
    expect(section.indexOf("create_organization")).toBeLessThan(section.indexOf("Path A: New owner"));
    // Step 1 points at it before any path is chosen.
    expect(guide.indexOf("## Step 1")).toBeLessThan(guide.indexOf("wants another organization"));
  });

  test("no longer says organizations cannot be created", () => {
    expect(guide).not.toMatch(/cannot create organizations/);
    expect(guide).toMatch(/only when the person asks/);
  });

  test("names the seven setup tools", () => {
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
