import { timeSince } from "@/lib/time";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TActionClass } from "@formbricks/types/action-classes";
import { ActionClassDataRow } from "./ActionRowData";

vi.mock("@/lib/time", () => ({
  timeSince: vi.fn(),
}));

const mockActionClass: TActionClass = {
  id: "testId",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Action",
  description: "This is a test action",
  type: "code",
  noCodeConfig: null,
  environmentId: "envId",
  key: null,
};

const locale = "en-US";
const timeSinceOutput = "2 hours ago";

describe("ActionClassDataRow", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders code action correctly", () => {
    vi.mocked(timeSince).mockReturnValue(timeSinceOutput);
    const actionClass = { ...mockActionClass, type: "code" } as TActionClass;
    render(<ActionClassDataRow actionClass={actionClass} locale={locale} />);

    expect(screen.getByText(actionClass.name)).toBeInTheDocument();
    expect(screen.getByText(actionClass.description!)).toBeInTheDocument();
    expect(screen.getByText(timeSinceOutput)).toBeInTheDocument();
    expect(timeSince).toHaveBeenCalledWith(actionClass.createdAt.toString(), locale);
  });

  test("renders no-code action correctly", () => {
    vi.mocked(timeSince).mockReturnValue(timeSinceOutput);
    const actionClass = { ...mockActionClass, type: "noCode" } as TActionClass;
    render(<ActionClassDataRow actionClass={actionClass} locale={locale} />);

    expect(screen.getByText(actionClass.name)).toBeInTheDocument();
    expect(screen.getByText(actionClass.description!)).toBeInTheDocument();
    expect(screen.getByText(timeSinceOutput)).toBeInTheDocument();
    expect(timeSince).toHaveBeenCalledWith(actionClass.createdAt.toString(), locale);
  });

  test("renders without description", () => {
    vi.mocked(timeSince).mockReturnValue(timeSinceOutput);
    const actionClass = { ...mockActionClass, description: undefined } as unknown as TActionClass;
    render(<ActionClassDataRow actionClass={actionClass} locale={locale} />);

    expect(screen.getByText(actionClass.name)).toBeInTheDocument();
    expect(screen.queryByText("This is a test action")).not.toBeInTheDocument();
    expect(screen.getByText(timeSinceOutput)).toBeInTheDocument();
  });
});
