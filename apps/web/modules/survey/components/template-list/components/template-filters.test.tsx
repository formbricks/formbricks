import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TemplateFilters } from "./template-filters";

vi.mock("../lib/utils", () => ({
  getChannelMapping: vi.fn(() => [
    { value: "channel1", label: "environments.surveys.templates.channel1" },
    { value: "channel2", label: "environments.surveys.templates.channel2" },
  ]),
  getIndustryMapping: vi.fn(() => [
    { value: "industry1", label: "environments.surveys.templates.industry1" },
    { value: "industry2", label: "environments.surveys.templates.industry2" },
  ]),
  getRoleMapping: vi.fn(() => [
    { value: "role1", label: "environments.surveys.templates.role1" },
    { value: "role2", label: "environments.surveys.templates.role2" },
  ]),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

describe("TemplateFilters", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all filter categories and options", () => {
    const setSelectedFilter = vi.fn();
    render(
      <TemplateFilters
        selectedFilter={[null, null, null]}
        setSelectedFilter={setSelectedFilter}
        prefilledFilters={[null, null, null]}
      />
    );

    expect(screen.getByText("environments.surveys.templates.all_channels")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.templates.all_industries")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.templates.all_roles")).toBeInTheDocument();

    expect(screen.getByText("environments.surveys.templates.channel1")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.templates.channel2")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.templates.industry1")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.templates.role1")).toBeInTheDocument();
  });

  test("clicking a filter button calls setSelectedFilter with correct parameters", async () => {
    const setSelectedFilter = vi.fn();
    const user = userEvent.setup();

    render(
      <TemplateFilters
        selectedFilter={[null, null, null]}
        setSelectedFilter={setSelectedFilter}
        prefilledFilters={[null, null, null]}
      />
    );

    await user.click(screen.getByText("environments.surveys.templates.channel1"));
    expect(setSelectedFilter).toHaveBeenCalledWith(["channel1", null, null]);

    await user.click(screen.getByText("environments.surveys.templates.industry1"));
    expect(setSelectedFilter).toHaveBeenCalledWith([null, "industry1", null]);
  });

  test("clicking 'All' button calls setSelectedFilter with null for that category", async () => {
    const setSelectedFilter = vi.fn();
    const user = userEvent.setup();

    render(
      <TemplateFilters
        selectedFilter={["link", "app", "website"]}
        setSelectedFilter={setSelectedFilter}
        prefilledFilters={[null, null, null]}
      />
    );

    await user.click(screen.getByText("environments.surveys.templates.all_channels"));
    expect(setSelectedFilter).toHaveBeenCalledWith([null, "app", "website"]);
  });

  test("filter buttons are disabled when templateSearch has a value", () => {
    const setSelectedFilter = vi.fn();

    render(
      <TemplateFilters
        selectedFilter={[null, null, null]}
        setSelectedFilter={setSelectedFilter}
        templateSearch="search term"
        prefilledFilters={[null, null, null]}
      />
    );

    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  test("does not render filter categories that are prefilled", () => {
    const setSelectedFilter = vi.fn();

    render(
      <TemplateFilters
        selectedFilter={["link", null, null]}
        setSelectedFilter={setSelectedFilter}
        prefilledFilters={["link", null, null]}
      />
    );

    expect(screen.queryByText("environments.surveys.templates.all_channels")).not.toBeInTheDocument();
    expect(screen.getByText("environments.surveys.templates.all_industries")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.templates.all_roles")).toBeInTheDocument();
  });
});
