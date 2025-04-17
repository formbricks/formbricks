import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TResponseVariables } from "@formbricks/types/responses";
import { TSurveyVariables } from "@formbricks/types/surveys/types";
import { ResponseVariables } from "./ResponseVariables";

const dummyVariables = [
  { id: "v1", name: "Variable One", type: "number" },
  { id: "v2", name: "Variable Two", type: "string" },
  { id: "v3", name: "Variable Three", type: "object" },
] as unknown as TSurveyVariables;

const dummyVariablesData = {
  v1: 123,
  v2: "abc",
  v3: { not: "valid" },
} as unknown as TResponseVariables;

// Mock tooltip components
vi.mock("@/modules/ui/components/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
}));

// Mock useTranslate
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (key: string) => key }),
}));

// Mock i18n utils
vi.mock("@/modules/i18n/utils", () => ({
  getLocalizedValue: vi.fn((val, _) => val),
  getLanguageCode: vi.fn().mockReturnValue("default"),
}));

// Mock lucide-react icons to render identifiable elements
vi.mock("lucide-react", () => ({
  FileDigitIcon: () => <div data-testid="FileDigitIcon" />,
  FileType2Icon: () => <div data-testid="FileType2Icon" />,
}));

describe("ResponseVariables", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders nothing when no variable in variablesData meets type check", () => {
    render(
      <ResponseVariables
        variables={dummyVariables}
        variablesData={{ v3: { not: "valid" } } as unknown as TResponseVariables}
      />
    );
    expect(screen.queryByText("Variable One")).toBeNull();
    expect(screen.queryByText("Variable Two")).toBeNull();
  });

  test("renders variables with valid response data", () => {
    render(<ResponseVariables variables={dummyVariables} variablesData={dummyVariablesData} />);
    expect(screen.getByText("Variable One")).toBeInTheDocument();
    expect(screen.getByText("Variable Two")).toBeInTheDocument();
    // Check that the value is rendered
    expect(screen.getByText("123")).toBeInTheDocument();
    expect(screen.getByText("abc")).toBeInTheDocument();
  });

  test("renders FileDigitIcon for number type and FileType2Icon for string type", () => {
    render(<ResponseVariables variables={dummyVariables} variablesData={dummyVariablesData} />);
    expect(screen.getByTestId("FileDigitIcon")).toBeInTheDocument();
    expect(screen.getByTestId("FileType2Icon")).toBeInTheDocument();
  });

  test("displays tooltip content with 'common.variable'", () => {
    render(<ResponseVariables variables={dummyVariables} variablesData={dummyVariablesData} />);
    // TooltipContent mock always renders its children directly.
    expect(screen.getAllByText("common.variable")[0]).toBeInTheDocument();
  });
});
