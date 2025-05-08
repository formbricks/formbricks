import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EnvironmentIdField } from "./environment-id-field";

vi.mock("@/modules/ui/components/code-block", () => ({
  CodeBlock: ({ children, language }: any) => (
    <pre data-testid="code-block" data-language={language}>
      {children}
    </pre>
  ),
}));

describe("EnvironmentIdField", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the environment id in a code block", () => {
    const envId = "env-123";
    render(<EnvironmentIdField environmentId={envId} />);
    const codeBlock = screen.getByTestId("code-block");
    expect(codeBlock).toBeInTheDocument();
    expect(codeBlock).toHaveAttribute("data-language", "js");
    expect(codeBlock).toHaveTextContent(envId);
  });

  test("applies the correct wrapper class", () => {
    render(<EnvironmentIdField environmentId="env-abc" />);
    const wrapper = codeBlockParent();
    expect(wrapper).toHaveClass("prose");
    expect(wrapper).toHaveClass("prose-slate");
    expect(wrapper).toHaveClass("-mt-3");
  });
});

function codeBlockParent() {
  return screen.getByTestId("code-block").parentElement as HTMLElement;
}
