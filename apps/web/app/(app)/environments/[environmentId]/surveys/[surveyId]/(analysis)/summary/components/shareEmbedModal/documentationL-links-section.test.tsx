import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DocumentationLinksSection } from "./documentation-links-section";

// Mock the useTranslate hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      if (key === "common.read_docs") {
        return "Read docs";
      }
      return key;
    },
  }),
}));

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock Alert components
vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children, size, variant }: any) => (
    <div data-testid="alert" data-size={size} data-variant={variant}>
      {children}
    </div>
  ),
  AlertButton: ({ children }: any) => <div data-testid="alert-button">{children}</div>,
  AlertTitle: ({ children }: any) => <div data-testid="alert-title">{children}</div>,
}));

// Mock Typography components
vi.mock("@/modules/ui/components/typography", () => ({
  H4: ({ children }: any) => <h4 data-testid="h4">{children}</h4>,
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ArrowUpRight: ({ className }: any) => <svg data-testid="arrow-up-right-icon" className={className} />,
}));

describe("DocumentationLinksSection", () => {
  afterEach(() => {
    cleanup();
  });

  const mockLinks = [
    {
      href: "https://example.com/docs/html",
      title: "HTML Documentation",
    },
    {
      href: "https://example.com/docs/react",
      title: "React Documentation",
    },
    {
      href: "https://example.com/docs/javascript",
      title: "JavaScript Documentation",
    },
  ];

  test("renders title correctly", () => {
    render(<DocumentationLinksSection title="Test Documentation Title" links={mockLinks} />);

    expect(screen.getByTestId("h4")).toHaveTextContent("Test Documentation Title");
  });

  test("renders all documentation links", () => {
    render(<DocumentationLinksSection title="Test Documentation Title" links={mockLinks} />);

    expect(screen.getAllByTestId("alert")).toHaveLength(3);
    expect(screen.getByText("HTML Documentation")).toBeInTheDocument();
    expect(screen.getByText("React Documentation")).toBeInTheDocument();
    expect(screen.getByText("JavaScript Documentation")).toBeInTheDocument();
  });

  test("renders links with correct href attributes", () => {
    render(<DocumentationLinksSection title="Test Documentation Title" links={mockLinks} />);

    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "https://example.com/docs/html");
    expect(links[1]).toHaveAttribute("href", "https://example.com/docs/react");
    expect(links[2]).toHaveAttribute("href", "https://example.com/docs/javascript");
  });

  test("renders links with correct target and rel attributes", () => {
    render(<DocumentationLinksSection title="Test Documentation Title" links={mockLinks} />);

    const links = screen.getAllByRole("link");
    links.forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  test("renders read docs button for each link", () => {
    render(<DocumentationLinksSection title="Test Documentation Title" links={mockLinks} />);

    const readDocsButtons = screen.getAllByText("Read docs");
    expect(readDocsButtons).toHaveLength(3);
  });

  test("renders icons for each alert", () => {
    render(<DocumentationLinksSection title="Test Documentation Title" links={mockLinks} />);

    const icons = screen.getAllByTestId("arrow-up-right-icon");
    expect(icons).toHaveLength(3);
  });

  test("renders alerts with correct props", () => {
    render(<DocumentationLinksSection title="Test Documentation Title" links={mockLinks} />);

    const alerts = screen.getAllByTestId("alert");
    alerts.forEach((alert) => {
      expect(alert).toHaveAttribute("data-size", "small");
      expect(alert).toHaveAttribute("data-variant", "default");
    });
  });

  test("renders with empty links array", () => {
    render(<DocumentationLinksSection title="Test Documentation Title" links={[]} />);

    expect(screen.getByTestId("h4")).toHaveTextContent("Test Documentation Title");
    expect(screen.queryByTestId("alert")).not.toBeInTheDocument();
  });

  test("renders single link correctly", () => {
    const singleLink = [
      {
        href: "https://example.com/docs/single",
        title: "Single Documentation",
      },
    ];

    render(<DocumentationLinksSection title="Test Documentation Title" links={singleLink} />);

    expect(screen.getAllByTestId("alert")).toHaveLength(1);
    expect(screen.getByText("Single Documentation")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://example.com/docs/single");
  });

  test("renders with special characters in title and links", () => {
    const specialLinks = [
      {
        href: "https://example.com/docs/special?param=value&other=test",
        title: "Special Characters & Symbols",
      },
    ];

    render(<DocumentationLinksSection title="Special Title & Characters" links={specialLinks} />);

    expect(screen.getByTestId("h4")).toHaveTextContent("Special Title & Characters");
    expect(screen.getByText("Special Characters & Symbols")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://example.com/docs/special?param=value&other=test"
    );
  });
});
