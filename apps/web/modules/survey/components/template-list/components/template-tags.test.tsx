import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TTemplate, TTemplateFilter } from "@formbricks/types/templates";
import { TemplateTags, getRoleBasedStyling } from "./template-tags";

vi.mock("../lib/utils", () => ({
  getRoleMapping: () => [{ value: "marketing", label: "Marketing" }],
  getChannelMapping: () => [
    { value: "email", label: "Email Survey" },
    { value: "chat", label: "Chat Survey" },
    { value: "sms", label: "SMS Survey" },
  ],
  getIndustryMapping: () => [
    { value: "indA", label: "Industry A" },
    { value: "indB", label: "Industry B" },
  ],
}));

const baseTemplate = {
  role: "marketing",
  channels: ["email"],
  industries: ["indA"],
  preset: { questions: [] },
} as unknown as TTemplate;

const noFilter: TTemplateFilter[] = [null, null];

describe("TemplateTags", () => {
  afterEach(() => {
    cleanup();
  });

  test("getRoleBasedStyling for productManager", () => {
    expect(getRoleBasedStyling("productManager")).toBe("border-blue-300 bg-blue-50 text-blue-500");
  });

  test("getRoleBasedStyling for sales", () => {
    expect(getRoleBasedStyling("sales")).toBe("border-emerald-300 bg-emerald-50 text-emerald-500");
  });

  test("getRoleBasedStyling for customerSuccess", () => {
    expect(getRoleBasedStyling("customerSuccess")).toBe("border-violet-300 bg-violet-50 text-violet-500");
  });

  test("getRoleBasedStyling for peopleManager", () => {
    expect(getRoleBasedStyling("peopleManager")).toBe("border-pink-300 bg-pink-50 text-pink-500");
  });

  test("getRoleBasedStyling default case", () => {
    expect(getRoleBasedStyling(undefined)).toBe("border-slate-300 bg-slate-50 text-slate-500");
  });

  test("renders role tag with correct styling and label", () => {
    render(<TemplateTags template={baseTemplate} selectedFilter={noFilter} />);
    const role = screen.getByText("Marketing");
    expect(role).toHaveClass("border-orange-300", "bg-orange-50", "text-orange-500");
  });

  test("single channel shows label without suffix", () => {
    render(<TemplateTags template={baseTemplate} selectedFilter={noFilter} />);
    expect(screen.getByText("Email Survey")).toBeInTheDocument();
  });

  test("two channels concatenated with 'common.or'", () => {
    const tpl = { ...baseTemplate, channels: ["email", "chat"] } as unknown as TTemplate;
    render(<TemplateTags template={tpl} selectedFilter={noFilter} />);
    expect(screen.getByText("Chat common.or Email")).toBeInTheDocument();
  });

  test("three channels shows 'environments.surveys.templates.all_channels'", () => {
    const tpl = { ...baseTemplate, channels: ["email", "chat", "sms"] } as unknown as TTemplate;
    render(<TemplateTags template={tpl} selectedFilter={noFilter} />);
    expect(screen.getByText("environments.surveys.templates.all_channels")).toBeInTheDocument();
  });

  test("more than three channels hides channel tag", () => {
    const tpl = { ...baseTemplate, channels: ["email", "chat", "sms", "email"] } as unknown as TTemplate;
    render(<TemplateTags template={tpl} selectedFilter={noFilter} />);
    expect(screen.queryByText(/Survey|common\.or|all_channels/)).toBeNull();
  });

  test("single industry shows mapped label", () => {
    render(<TemplateTags template={baseTemplate} selectedFilter={noFilter} />);
    expect(screen.getByText("Industry A")).toBeInTheDocument();
  });

  test("multiple industries shows 'multiple_industries'", () => {
    const tpl = { ...baseTemplate, industries: ["indA", "indB"] } as unknown as TTemplate;
    render(<TemplateTags template={tpl} selectedFilter={noFilter} />);
    expect(screen.getByText("environments.surveys.templates.multiple_industries")).toBeInTheDocument();
  });

  test("selectedFilter[1] overrides industry tag", () => {
    render(<TemplateTags template={baseTemplate} selectedFilter={[null, "marketing"]} />);
    expect(screen.getByText("Marketing")).toBeInTheDocument();
  });

  test("renders branching logic icon when questions have logic", () => {
    const tpl = { ...baseTemplate, preset: { questions: [{ logic: [1] }] } } as unknown as TTemplate;
    render(<TemplateTags template={tpl} selectedFilter={noFilter} />);
    expect(document.querySelector("svg")).toBeInTheDocument();
  });
});
