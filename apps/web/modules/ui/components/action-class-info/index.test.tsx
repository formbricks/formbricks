import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TActionClass } from "@formbricks/types/action-classes";
import { ActionClassInfo } from "./index";

describe("ActionClassInfo", () => {
  afterEach(() => {
    cleanup();
  });

  const mockCodeActionClass: TActionClass = {
    id: "action-1",
    name: "Code Action",
    description: "Test code action description",
    type: "code",
    key: "test-key",
    noCodeConfig: null,
    environmentId: "env-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNoCodeClickActionClass: TActionClass = {
    id: "action-2",
    name: "NoCode Click Action",
    description: "Test nocode click action description",
    type: "noCode",
    key: null,
    noCodeConfig: {
      type: "click",
      urlFilters: [
        { rule: "exactMatch", value: "https://example.com" },
        { rule: "contains", value: "/dashboard" },
      ],
      elementSelector: {
        cssSelector: ".button-class",
        innerHtml: "Click me",
      },
    },
    environmentId: "env-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNoCodePageViewActionClass: TActionClass = {
    id: "action-3",
    name: "NoCode PageView Action",
    description: "Test nocode pageview action description",
    type: "noCode",
    key: null,
    noCodeConfig: {
      type: "pageView",
      urlFilters: [{ rule: "startsWith", value: "https://app.example.com" }],
    },
    environmentId: "env-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockActionClassWithoutDescription: TActionClass = {
    id: "action-4",
    name: "Action Without Description",
    description: null,
    type: "code",
    key: "no-desc-key",
    noCodeConfig: null,
    environmentId: "env-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRegexActionClass: TActionClass = {
    id: "action-5",
    name: "Regex Action",
    description: "Test regex action description",
    type: "noCode",
    key: null,
    noCodeConfig: {
      type: "pageView",
      urlFilters: [
        { rule: "matchesRegex", value: "^https://app\\.example\\.com/user/\\d+$" },
        { rule: "contains", value: "/dashboard" },
      ],
    },
    environmentId: "env-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMixedFilterActionClass: TActionClass = {
    id: "action-6",
    name: "Mixed Filter Action",
    description: "Test action with mixed filter types",
    type: "noCode",
    key: null,
    noCodeConfig: {
      type: "click",
      urlFilters: [
        { rule: "startsWith", value: "https://secure" },
        { rule: "matchesRegex", value: "/checkout/\\w+/complete" },
        { rule: "notContains", value: "test" },
      ],
      elementSelector: {
        cssSelector: ".submit-btn",
        innerHtml: "Submit",
      },
    },
    environmentId: "env-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  test("renders description when present", () => {
    render(<ActionClassInfo actionClass={mockCodeActionClass} />);

    expect(screen.getByText("Test code action description")).toBeInTheDocument();
  });

  test("does not render description when null", () => {
    render(<ActionClassInfo actionClass={mockActionClassWithoutDescription} />);

    expect(screen.queryByText("Test code action description")).not.toBeInTheDocument();
  });

  test("renders code action key", () => {
    render(<ActionClassInfo actionClass={mockCodeActionClass} />);

    expect(
      screen.getByText((content) => content.includes("environments.surveys.edit.key"))
    ).toBeInTheDocument();
    expect(screen.getByText("test-key")).toBeInTheDocument();
  });

  test("renders noCode click action with CSS selector", () => {
    render(<ActionClassInfo actionClass={mockNoCodeClickActionClass} />);

    expect(
      screen.getByText((content) => content.includes("environments.surveys.edit.css_selector"))
    ).toBeInTheDocument();
    expect(screen.getByText(".button-class")).toBeInTheDocument();
  });

  test("renders noCode click action with inner HTML", () => {
    render(<ActionClassInfo actionClass={mockNoCodeClickActionClass} />);

    expect(
      screen.getByText((content) => content.includes("environments.surveys.edit.inner_text"))
    ).toBeInTheDocument();
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  test("renders URL filters for noCode actions", () => {
    const { container } = render(<ActionClassInfo actionClass={mockNoCodeClickActionClass} />);

    expect(
      screen.getByText((content) => content.includes("environments.surveys.edit.url_filters"))
    ).toBeInTheDocument();
    expect(container).toHaveTextContent("exactMatch");
    expect(container).toHaveTextContent("https://example.com");
    expect(container).toHaveTextContent("contains");
    expect(container).toHaveTextContent("/dashboard");
  });

  test("renders URL filters with comma separation", () => {
    const { container } = render(<ActionClassInfo actionClass={mockNoCodeClickActionClass} />);

    expect(container).toHaveTextContent("exactMatch");
    expect(container).toHaveTextContent("https://example.com");
    expect(container).toHaveTextContent("contains");
    expect(container).toHaveTextContent("/dashboard");
  });

  test("renders noCode pageView action without element selector", () => {
    render(<ActionClassInfo actionClass={mockNoCodePageViewActionClass} />);

    expect(screen.getByText("Test nocode pageview action description")).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes("environments.surveys.edit.url_filters"))
    ).toBeInTheDocument();
    expect(screen.getByText("startsWith")).toBeInTheDocument();
    expect(screen.getByText("https://app.example.com")).toBeInTheDocument();

    // Should not render CSS selector or inner HTML for pageView
    expect(
      screen.queryByText((content) => content.includes("environments.surveys.edit.css_selector"))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText((content) => content.includes("environments.surveys.edit.inner_text"))
    ).not.toBeInTheDocument();
  });

  test("does not render URL filters when empty", () => {
    const actionWithoutUrlFilters: TActionClass = {
      ...mockNoCodeClickActionClass,
      noCodeConfig: {
        type: "click",
        urlFilters: [],
        elementSelector: {
          cssSelector: ".button-class",
          innerHtml: "Click me",
        },
      },
    };

    render(<ActionClassInfo actionClass={actionWithoutUrlFilters} />);

    expect(screen.queryByText("environments.surveys.edit.url_filters")).not.toBeInTheDocument();
  });

  test("does not render CSS selector when not present", () => {
    const actionWithoutCssSelector: TActionClass = {
      ...mockNoCodeClickActionClass,
      noCodeConfig: {
        type: "click",
        urlFilters: [{ rule: "exactMatch", value: "https://example.com" }],
        elementSelector: {
          innerHtml: "Click me",
        },
      },
    };

    render(<ActionClassInfo actionClass={actionWithoutCssSelector} />);

    expect(
      screen.queryByText((content) => content.includes("environments.surveys.edit.css_selector"))
    ).not.toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes("environments.surveys.edit.inner_text"))
    ).toBeInTheDocument();
  });

  test("does not render inner HTML when not present", () => {
    const actionWithoutInnerHtml: TActionClass = {
      ...mockNoCodeClickActionClass,
      noCodeConfig: {
        type: "click",
        urlFilters: [{ rule: "exactMatch", value: "https://example.com" }],
        elementSelector: {
          cssSelector: ".button-class",
        },
      },
    };

    render(<ActionClassInfo actionClass={actionWithoutInnerHtml} />);

    expect(
      screen.getByText((content) => content.includes("environments.surveys.edit.css_selector"))
    ).toBeInTheDocument();
    expect(
      screen.queryByText((content) => content.includes("environments.surveys.edit.inner_text"))
    ).not.toBeInTheDocument();
  });

  test("applies custom className", () => {
    const { container } = render(
      <ActionClassInfo actionClass={mockCodeActionClass} className="custom-class" />
    );

    const div = container.querySelector("div");
    expect(div).toHaveClass("custom-class");
  });

  test("has correct default styling", () => {
    const { container } = render(<ActionClassInfo actionClass={mockCodeActionClass} />);

    const div = container.querySelector("div");
    expect(div).toHaveClass("mt-1", "text-xs", "text-slate-500");
  });

  test("renders single URL filter without comma", () => {
    const actionWithSingleFilter: TActionClass = {
      ...mockNoCodeClickActionClass,
      noCodeConfig: {
        type: "click",
        urlFilters: [{ rule: "exactMatch", value: "https://example.com" }],
        elementSelector: {
          cssSelector: ".button-class",
          innerHtml: "Click me",
        },
      },
    };

    const { container } = render(<ActionClassInfo actionClass={actionWithSingleFilter} />);

    expect(container).toHaveTextContent("exactMatch");
    expect(container).toHaveTextContent("https://example.com");
    expect(container).not.toHaveTextContent(",");
  });

  test("renders URL filters with regex rule", () => {
    const { container } = render(<ActionClassInfo actionClass={mockRegexActionClass} />);

    expect(
      screen.getByText((content) => content.includes("environments.surveys.edit.url_filters"))
    ).toBeInTheDocument();
    expect(container).toHaveTextContent("matchesRegex");
    expect(container).toHaveTextContent("^https://app\\.example\\.com/user/\\d+$");
    expect(container).toHaveTextContent("contains");
    expect(container).toHaveTextContent("/dashboard");
  });

  test("renders mixed URL filter types including regex", () => {
    const { container } = render(<ActionClassInfo actionClass={mockMixedFilterActionClass} />);

    expect(
      screen.getByText((content) => content.includes("environments.surveys.edit.url_filters"))
    ).toBeInTheDocument();

    // Check all filter types are displayed
    expect(container).toHaveTextContent("startsWith");
    expect(container).toHaveTextContent("https://secure");
    expect(container).toHaveTextContent("matchesRegex");
    expect(container).toHaveTextContent("/checkout/\\w+/complete");
    expect(container).toHaveTextContent("notContains");
    expect(container).toHaveTextContent("test");

    // Check element selector is also displayed
    expect(
      screen.getByText((content) => content.includes("environments.surveys.edit.css_selector"))
    ).toBeInTheDocument();
    expect(screen.getByText(".submit-btn")).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes("environments.surveys.edit.inner_text"))
    ).toBeInTheDocument();
    expect(screen.getByText("Submit")).toBeInTheDocument();
  });

  test("renders complex regex patterns correctly", () => {
    const complexRegexAction: TActionClass = {
      ...mockRegexActionClass,
      noCodeConfig: {
        type: "pageView",
        urlFilters: [
          {
            rule: "matchesRegex",
            value: "^https://(app|admin)\\.example\\.com/(?:user|profile)/\\d+(?:/edit)?$",
          },
        ],
      },
    };

    const { container } = render(<ActionClassInfo actionClass={complexRegexAction} />);

    expect(container).toHaveTextContent("matchesRegex");
    expect(container).toHaveTextContent(
      "^https://(app|admin)\\.example\\.com/(?:user|profile)/\\d+(?:/edit)?$"
    );
  });

  test("handles regex with special characters in display", () => {
    const specialCharsRegexAction: TActionClass = {
      ...mockRegexActionClass,
      noCodeConfig: {
        type: "click",
        urlFilters: [{ rule: "matchesRegex", value: "\\[\\{\\(.*\\)\\}\\]" }],
        elementSelector: {
          cssSelector: ".btn",
        },
      },
    };

    const { container } = render(<ActionClassInfo actionClass={specialCharsRegexAction} />);

    expect(container).toHaveTextContent("matchesRegex");
    expect(container).toHaveTextContent("\\[\\{\\(.*\\)\\}\\]");
  });
});
