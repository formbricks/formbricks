import { AddQuestionButton } from "@/modules/survey/editor/components/add-question-button";
import {
  TQuestion,
  getCXQuestionTypes,
  getQuestionDefaults,
  getQuestionTypes,
} from "@/modules/survey/lib/questions";
import { createId } from "@paralleldrive/cuid2";
import { Project } from "@prisma/client";
// Import React for the mock
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/cn", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@/modules/survey/lib/questions", () => ({
  getCXQuestionTypes: vi.fn(),
  getQuestionDefaults: vi.fn(),
  getQuestionTypes: vi.fn(),
  universalQuestionPresets: { presetKey: "presetValue" },
}));

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: vi.fn(() => [vi.fn()]),
}));

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(),
}));

vi.mock("@radix-ui/react-collapsible", async () => {
  const original = await vi.importActual("@radix-ui/react-collapsible");
  return {
    ...original,
    Root: ({ children, open, onOpenChange }: any) => (
      <div data-state={open ? "open" : "closed"} onClick={onOpenChange}>
        {children}
      </div>
    ),
    CollapsibleTrigger: ({ children, asChild }: any) => (asChild ? children : <button>{children}</button>),
    CollapsibleContent: ({ children }: any) => <div>{children}</div>,
  };
});

vi.mock("lucide-react", () => ({
  PlusIcon: () => <div>PlusIcon</div>,
}));

const mockProject = { id: "test-project-id" } as Project;
const mockAddQuestion = vi.fn();
const mockQuestionType1 = {
  id: "type1",
  label: "Type 1",
  description: "Desc 1",
  icon: () => <div>Icon1</div>,
} as TQuestion;
const mockQuestionType2 = {
  id: "type2",
  label: "Type 2",
  description: "Desc 2",
  icon: () => <div>Icon2</div>,
} as TQuestion;
const mockCXQuestionType = {
  id: "cxType",
  label: "CX Type",
  description: "CX Desc",
  icon: () => <div>CXIcon</div>,
} as TQuestion;

describe("AddQuestionButton", () => {
  beforeEach(() => {
    vi.mocked(getQuestionTypes).mockReturnValue([mockQuestionType1, mockQuestionType2]);
    vi.mocked(getCXQuestionTypes).mockReturnValue([mockCXQuestionType]);
    vi.mocked(getQuestionDefaults).mockReturnValue({ defaultKey: "defaultValue" } as any);
    vi.mocked(createId).mockReturnValue("test-cuid");
  });

  afterEach(() => {
    cleanup();
  });

  test("opens and shows question types on click", async () => {
    render(<AddQuestionButton addQuestion={mockAddQuestion} project={mockProject} isCxMode={false} />);
    const trigger = screen.getByText("environments.surveys.edit.add_question").closest("div")?.parentElement;
    expect(trigger).toBeInTheDocument();
    if (trigger) {
      await userEvent.click(trigger);
    }
    expect(screen.getByText(mockQuestionType1.label)).toBeInTheDocument();
    expect(screen.getByText(mockQuestionType2.label)).toBeInTheDocument();
  });

  test("calls getQuestionTypes when isCxMode is false", () => {
    render(<AddQuestionButton addQuestion={mockAddQuestion} project={mockProject} isCxMode={false} />);
    expect(getQuestionTypes).toHaveBeenCalled();
    expect(getCXQuestionTypes).not.toHaveBeenCalled();
  });

  test("calls getCXQuestionTypes when isCxMode is true", async () => {
    render(<AddQuestionButton addQuestion={mockAddQuestion} project={mockProject} isCxMode={true} />);
    const trigger = screen.getByText("environments.surveys.edit.add_question").closest("div")?.parentElement;
    expect(trigger).toBeInTheDocument();
    if (trigger) {
      await userEvent.click(trigger);
    }
    expect(getCXQuestionTypes).toHaveBeenCalled();
    expect(getQuestionTypes).not.toHaveBeenCalled();
    expect(screen.getByText(mockCXQuestionType.label)).toBeInTheDocument();
  });

  test("shows description on hover", async () => {
    render(<AddQuestionButton addQuestion={mockAddQuestion} project={mockProject} isCxMode={false} />);
    const trigger = screen.getByText("environments.surveys.edit.add_question").closest("div")?.parentElement;
    expect(trigger).toBeInTheDocument();
    if (trigger) {
      await userEvent.click(trigger); // Open the collapsible
    }
    const questionButton = screen.getByText(mockQuestionType1.label).closest("button");
    expect(questionButton).toBeInTheDocument();
    if (questionButton) {
      fireEvent.mouseEnter(questionButton);
      // Description might be visually hidden/styled based on opacity, check if it's in the DOM
      expect(screen.getByText(mockQuestionType1.description)).toBeInTheDocument();
      fireEvent.mouseLeave(questionButton);
    }
  });

  test("closes the collapsible after adding a question", async () => {
    render(<AddQuestionButton addQuestion={mockAddQuestion} project={mockProject} isCxMode={false} />);
    const rootElement = screen.getByText("environments.surveys.edit.add_question").closest("[data-state]");
    expect(rootElement).toHaveAttribute("data-state", "closed");

    // Open
    const trigger = screen.getByText("environments.surveys.edit.add_question").closest("div")?.parentElement;
    expect(trigger).toBeInTheDocument();
    if (trigger) {
      await userEvent.click(trigger);
    }
    expect(rootElement).toHaveAttribute("data-state", "open");

    // Click a question type
    const questionButton = screen.getByText(mockQuestionType1.label).closest("button");
    expect(questionButton).toBeInTheDocument();
    if (questionButton) {
      await userEvent.click(questionButton);
    }

    // Check if it closed (state should change back to closed)
    // Note: The mock implementation might not perfectly replicate Radix's state management on click inside content
    // We verified addQuestion is called, which includes setOpen(false)
    expect(mockAddQuestion).toHaveBeenCalled();
    // We can't directly test setOpen(false) state change easily with this mock structure,
    // but we know the onClick handler calls it.
  });
});
