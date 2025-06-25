import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurveyHiddenFields } from "@formbricks/types/surveys/types";
import { HiddenFields } from "./HiddenFields";

// Mock tooltip components to always render their children
vi.mock("@/modules/ui/components/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("HiddenFields", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders empty container when no fieldIds are provided", () => {
    render(
      <HiddenFields hiddenFields={{ fieldIds: [] } as unknown as TSurveyHiddenFields} responseData={{}} />
    );
    const container = screen.getByTestId("main-hidden-fields-div");
    expect(container).toBeDefined();
  });

  test("renders nothing for fieldIds with no corresponding response data", () => {
    render(
      <HiddenFields
        hiddenFields={{ fieldIds: ["field1"] } as unknown as TSurveyHiddenFields}
        responseData={{}}
      />
    );
    expect(screen.queryByText("field1")).toBeNull();
  });

  test("renders field and value when responseData exists and is a string", async () => {
    render(
      <HiddenFields
        hiddenFields={{ fieldIds: ["field1", "field2"] } as unknown as TSurveyHiddenFields}
        responseData={{ field1: "Value 1", field2: "" }}
      />
    );
    expect(screen.getByText("field1")).toBeInTheDocument();
    expect(screen.getByText("Value 1")).toBeInTheDocument();
    expect(screen.queryByText("field2")).toBeNull();
  });

  test("renders empty text when responseData value is not a string", () => {
    render(
      <HiddenFields
        hiddenFields={{ fieldIds: ["field1"] } as unknown as TSurveyHiddenFields}
        responseData={{ field1: { any: "object" } }}
      />
    );
    expect(screen.getByText("field1")).toBeInTheDocument();
    const valueParagraphs = screen.getAllByText("", { selector: "p" });
    expect(valueParagraphs.length).toBeGreaterThan(0);
  });

  test("displays tooltip content for hidden field", async () => {
    render(
      <HiddenFields
        hiddenFields={{ fieldIds: ["field1"] } as unknown as TSurveyHiddenFields}
        responseData={{ field1: "Value 1" }}
      />
    );
    expect(screen.getByText("common.hidden_field")).toBeInTheDocument();
  });
});
