import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TResponseNote } from "@formbricks/types/responses";
import { TUser } from "@formbricks/types/user";
import { createResponseNoteAction, resolveResponseNoteAction, updateResponseNoteAction } from "../actions";
import { ResponseNotes } from "./ResponseNote";

const dummyUser = { id: "user1", name: "User One" } as TUser;
const dummyResponseId = "resp1";
const dummyLocale = "en-US";
const dummyNote = {
  id: "note1",
  text: "Initial note",
  isResolved: true,
  isEdited: false,
  updatedAt: new Date(),
  user: { id: "user1", name: "User One" },
} as TResponseNote;
const dummyUnresolvedNote = {
  id: "note1",
  text: "Initial note",
  isResolved: false,
  isEdited: false,
  updatedAt: new Date(),
  user: { id: "user1", name: "User One" },
} as TResponseNote;
const updateFetchedResponses = vi.fn();
const setIsOpen = vi.fn();

vi.mock("../actions", () => ({
  createResponseNoteAction: vi.fn().mockResolvedValue("createdNote"),
  updateResponseNoteAction: vi.fn().mockResolvedValue("updatedNote"),
  resolveResponseNoteAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: (props: any) => <button {...props}>{props.children}</button>,
}));

// Mock icons for edit and resolve buttons with test ids
vi.mock("lucide-react", () => {
  const actual = vi.importActual("lucide-react");
  return {
    ...actual,
    PencilIcon: (props: any) => (
      <button data-testid="pencil-button" {...props}>
        Pencil
      </button>
    ),
    CheckIcon: (props: any) => (
      <button data-testid="check-button" {...props}>
        Check
      </button>
    ),
    PlusIcon: (props: any) => (
      <span data-testid="plus-icon" {...props}>
        Plus
      </span>
    ),
    Maximize2Icon: (props: any) => (
      <span data-testid="maximize-icon" {...props}>
        Maximize
      </span>
    ),
    Minimize2Icon: (props: any) => (
      <button data-testid="minimize-button" {...props}>
        Minimize
      </button>
    ),
  };
});

// Mock tooltip components
vi.mock("@/modules/ui/components/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
}));

describe("ResponseNotes", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders collapsed view when isOpen is false", () => {
    render(
      <ResponseNotes
        user={dummyUser}
        responseId={dummyResponseId}
        notes={[dummyNote]}
        isOpen={false}
        setIsOpen={setIsOpen}
        updateFetchedResponses={updateFetchedResponses}
        locale={dummyLocale}
      />
    );
    expect(screen.getByText(/note/i)).toBeInTheDocument();
  });

  test("opens panel on click when collapsed", async () => {
    render(
      <ResponseNotes
        user={dummyUser}
        responseId={dummyResponseId}
        notes={[dummyNote]}
        isOpen={false}
        setIsOpen={setIsOpen}
        updateFetchedResponses={updateFetchedResponses}
        locale={dummyLocale}
      />
    );
    await userEvent.click(screen.getByText(/note/i));
    expect(setIsOpen).toHaveBeenCalledWith(true);
  });

  test("submits a new note", async () => {
    vi.mocked(createResponseNoteAction).mockResolvedValueOnce("createdNote" as any);
    render(
      <ResponseNotes
        user={dummyUser}
        responseId={dummyResponseId}
        notes={[]}
        isOpen={true}
        setIsOpen={setIsOpen}
        updateFetchedResponses={updateFetchedResponses}
        locale={dummyLocale}
      />
    );
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "New note");
    await userEvent.type(textarea, "{enter}");
    await waitFor(() => {
      expect(createResponseNoteAction).toHaveBeenCalledWith({
        responseId: dummyResponseId,
        text: "New note",
      });
      expect(updateFetchedResponses).toHaveBeenCalled();
    });
  });

  test("edits an existing note", async () => {
    vi.mocked(updateResponseNoteAction).mockResolvedValueOnce("updatedNote" as any);
    render(
      <ResponseNotes
        user={dummyUser}
        responseId={dummyResponseId}
        notes={[dummyUnresolvedNote]}
        isOpen={true}
        setIsOpen={setIsOpen}
        updateFetchedResponses={updateFetchedResponses}
        locale={dummyLocale}
      />
    );
    const pencilButton = screen.getByTestId("pencil-button");
    await userEvent.click(pencilButton);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("Initial note");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Updated note");
    await userEvent.type(textarea, "{enter}");
    await waitFor(() => {
      expect(updateResponseNoteAction).toHaveBeenCalledWith({
        responseNoteId: dummyNote.id,
        text: "Updated note",
      });
      expect(updateFetchedResponses).toHaveBeenCalled();
    });
  });

  test("resolves a note", async () => {
    vi.mocked(resolveResponseNoteAction).mockResolvedValueOnce(undefined);
    render(
      <ResponseNotes
        user={dummyUser}
        responseId={dummyResponseId}
        notes={[dummyUnresolvedNote]}
        isOpen={true}
        setIsOpen={setIsOpen}
        updateFetchedResponses={updateFetchedResponses}
        locale={dummyLocale}
      />
    );
    const checkButton = screen.getByTestId("check-button");
    userEvent.click(checkButton);
    await waitFor(() => {
      expect(resolveResponseNoteAction).toHaveBeenCalledWith({ responseNoteId: dummyNote.id });
      expect(updateFetchedResponses).toHaveBeenCalled();
    });
  });

  test("pressing Enter in textarea only submits form and doesn't trigger parent button onClick", async () => {
    vi.mocked(createResponseNoteAction).mockResolvedValueOnce("createdNote" as any);
    render(
      <ResponseNotes
        user={dummyUser}
        responseId={dummyResponseId}
        notes={[]}
        isOpen={true}
        setIsOpen={setIsOpen}
        updateFetchedResponses={updateFetchedResponses}
        locale={dummyLocale}
      />
    );
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "New note");
    await userEvent.type(textarea, "{enter}");
    await waitFor(() => {
      expect(createResponseNoteAction).toHaveBeenCalledWith({
        responseId: dummyResponseId,
        text: "New note",
      });
      expect(updateFetchedResponses).toHaveBeenCalled();
      expect(setIsOpen).not.toHaveBeenCalled();
    });
  });
});
