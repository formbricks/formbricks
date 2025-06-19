import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SetupInstructions } from "./setup-instructions";

// Mock the translation hook to simply return the key.
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the TabBar component.
vi.mock("@/modules/ui/components/tab-bar", () => ({
  TabBar: ({ tabs, setActiveId }: any) => (
    <div>
      {tabs.map((tab: any) => (
        <button key={tab.id} onClick={() => setActiveId(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  ),
}));

// Mock the CodeBlock component.
vi.mock("@/modules/ui/components/code-block", () => ({
  CodeBlock: ({ children }: { children: React.ReactNode; language?: string }) => (
    <pre data-testid="code-block">{children}</pre>
  ),
}));

// Mock Next.js Link to simply render an anchor.
vi.mock("next/link", () => {
  return {
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
  };
});

describe("SetupInstructions Component", () => {
  const environmentId = "env123";
  const webAppUrl = "https://example.com";
  const publicDomain = "https://example.com";

  beforeEach(() => {
    // Optionally reset mocks if needed
    vi.clearAllMocks();
  });

  test("renders npm instructions by default", () => {
    render(<SetupInstructions environmentId={environmentId} publicDomain={publicDomain} />);

    // Verify that the npm tab is active by default by checking for a code block with npm install instructions.
    expect(screen.getByText("pnpm install @formbricks/js")).toBeInTheDocument();

    // Verify that the TabBar renders both "NPM" and "HTML" buttons.
    expect(screen.getByRole("button", { name: /NPM/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /HTML/i })).toBeInTheDocument();
  });

  test("switches to html tab and displays html instructions", async () => {
    render(<SetupInstructions environmentId="env123" publicDomain="https://example.com" />);

    // Instead of getByRole (which finds multiple buttons), use getAllByRole and select the first HTML tab.
    const htmlTabButtons = screen.getAllByRole("button", { name: /HTML/i });
    expect(htmlTabButtons.length).toBeGreaterThan(0);
    const htmlTabButton = htmlTabButtons[0];

    fireEvent.click(htmlTabButton);

    // Wait for the HTML instructions to appear.
    await waitFor(() => {
      expect(screen.getByText(/<!-- START Formbricks Surveys -->/i)).toBeInTheDocument();
    });
  });

  test("npm instructions code block contains environmentId and webAppUrl", async () => {
    render(<SetupInstructions environmentId={environmentId} publicDomain={publicDomain} />);

    // The NPM tab is the default view.
    // Find all code block elements.
    const codeBlocks = screen.getAllByTestId("code-block");
    // The setup code block (language "js") should include the environmentId and webAppUrl.
    // We filter for the one containing 'formbricks.setup' and our environment values.
    const setupCodeBlock = codeBlocks.find(
      (block) => block.textContent?.includes("formbricks.setup") && block.textContent?.includes(environmentId)
    );
    expect(setupCodeBlock).toBeDefined();
    expect(setupCodeBlock?.textContent).toContain(environmentId);
    expect(setupCodeBlock?.textContent).toContain(publicDomain);
  });
});
