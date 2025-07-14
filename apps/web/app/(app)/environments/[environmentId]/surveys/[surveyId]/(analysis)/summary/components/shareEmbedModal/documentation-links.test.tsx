import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { DocumentationLinks } from "./documentation-links";

describe("DocumentationLinks", () => {
  afterEach(() => {
    cleanup();
  });

  const mockLinks = [
    {
      title: "Getting Started Guide",
      href: "https://docs.formbricks.com/getting-started",
    },
    {
      title: "API Documentation",
      href: "https://docs.formbricks.com/api",
    },
    {
      title: "Integration Guide",
      href: "https://docs.formbricks.com/integrations",
    },
  ];

  test("renders all documentation links", () => {
    render(<DocumentationLinks links={mockLinks} />);

    expect(screen.getByText("Getting Started Guide")).toBeInTheDocument();
    expect(screen.getByText("API Documentation")).toBeInTheDocument();
    expect(screen.getByText("Integration Guide")).toBeInTheDocument();
  });

  test("renders correct number of alert components", () => {
    render(<DocumentationLinks links={mockLinks} />);

    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(3);
  });

  test("renders learn more links with correct href attributes", () => {
    render(<DocumentationLinks links={mockLinks} />);

    const learnMoreLinks = screen.getAllByText("common.learn_more");
    expect(learnMoreLinks).toHaveLength(3);

    expect(learnMoreLinks[0]).toHaveAttribute("href", "https://docs.formbricks.com/getting-started");
    expect(learnMoreLinks[1]).toHaveAttribute("href", "https://docs.formbricks.com/api");
    expect(learnMoreLinks[2]).toHaveAttribute("href", "https://docs.formbricks.com/integrations");
  });

  test("renders learn more links with target blank", () => {
    render(<DocumentationLinks links={mockLinks} />);

    const learnMoreLinks = screen.getAllByText("common.learn_more");
    learnMoreLinks.forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
    });
  });

  test("renders learn more links with correct CSS classes", () => {
    render(<DocumentationLinks links={mockLinks} />);

    const learnMoreLinks = screen.getAllByText("common.learn_more");
    learnMoreLinks.forEach((link) => {
      expect(link).toHaveClass("text-slate-900", "hover:underline");
    });
  });

  test("renders empty list when no links provided", () => {
    render(<DocumentationLinks links={[]} />);

    const alerts = screen.queryAllByRole("alert");
    expect(alerts).toHaveLength(0);
  });

  test("renders single link correctly", () => {
    const singleLink = [mockLinks[0]];
    render(<DocumentationLinks links={singleLink} />);

    expect(screen.getByText("Getting Started Guide")).toBeInTheDocument();
    expect(screen.getByText("common.learn_more")).toBeInTheDocument();
    expect(screen.getByText("common.learn_more")).toHaveAttribute(
      "href",
      "https://docs.formbricks.com/getting-started"
    );
  });

  test("renders with correct container structure", () => {
    const { container } = render(<DocumentationLinks links={mockLinks} />);

    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer).toHaveClass("flex", "w-full", "flex-col", "space-y-2");

    const linkContainers = mainContainer.children;
    expect(linkContainers).toHaveLength(3);

    Array.from(linkContainers).forEach((linkContainer) => {
      expect(linkContainer).toHaveClass("flex", "w-full", "flex-col", "gap-3");
    });
  });
});
