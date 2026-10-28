import { beforeEach, describe, expect, test, vi } from "vitest";
import { MCP_SETUP_PROMPT_NAME, getMcpServerInstructions, registerMcpPrompts } from "./index";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ getMcpResourceUrl: vi.fn() }));

vi.mock("@/modules/auth/lib/oauth-urls", () => ({ getMcpResourceUrl: mocks.getMcpResourceUrl }));

type TPromptConfig = { title?: string; description?: string; argsSchema?: unknown };
type TPromptHandler = () => {
  messages: { role: string; content: { type: string; text: string } }[];
};

function setup() {
  const prompts = new Map<string, { config: TPromptConfig; handler: TPromptHandler }>();
  const server = {
    registerPrompt: vi.fn((name: string, config: TPromptConfig, handler: TPromptHandler) => {
      prompts.set(name, { config, handler });
    }),
  };
  registerMcpPrompts(server as unknown as Parameters<typeof registerMcpPrompts>[0]);
  return prompts;
}

describe("MCP prompts", () => {
  beforeEach(() => {
    mocks.getMcpResourceUrl.mockReturnValue("https://app.example.com/api/mcp");
  });

  test("registers a `setup` prompt with the product title and no required arguments", () => {
    const prompts = setup();
    const { config } = prompts.get("setup")!;

    expect(MCP_SETUP_PROMPT_NAME).toBe("setup");
    expect(config.title).toBe("Set up my Formbricks account");
    expect(config.argsSchema).toBeUndefined();
    expect([...prompts.keys()]).toEqual(["setup"]);
  });

  test("returns the setup guide for this instance as one user message", () => {
    const { handler } = setup().get("setup")!;
    const { messages } = handler();

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content.type).toBe("text");
    expect(messages[0].content.text).toContain("# Set up a Formbricks account");
    expect(messages[0].content.text).toContain("https://app.example.com/api/mcp");
  });
});

describe("getMcpServerInstructions", () => {
  test("says what the server is, where to start and where the guide lives", () => {
    mocks.getMcpResourceUrl.mockReturnValue("https://app.example.com/api/mcp");
    const instructions = getMcpServerInstructions();

    expect(instructions).toContain("get_account_context");
    expect(instructions).toContain("https://app.example.com/agents/setup.md");
    expect(instructions).toContain("run the setup prompt");
    expect(instructions.length).toBeLessThan(600);
  });
});
