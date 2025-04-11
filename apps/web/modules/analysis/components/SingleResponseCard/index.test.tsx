import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { deleteResponseAction, getResponseAction } from "./actions";
import { SingleResponseCard } from "./index";

// Dummy data for props
const dummySurvey = {
  id: "survey1",
  environmentId: "env1",
  name: "Test Survey",
  status: "completed",
  type: "link",
  questions: [{ id: "q1" }, { id: "q2" }],
  responseCount: 10,
  notes: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as unknown as TSurvey;
const dummyResponse = {
  id: "resp1",
  finished: true,
  data: { q1: "answer1", q2: null },
  notes: [],
  tags: [],
} as unknown as TResponse;
const dummyEnvironment = { id: "env1" } as TEnvironment;
const dummyUser = { id: "user1", email: "user1@example.com", name: "User One" } as TUser;
const dummyLocale = "en-US";

const dummyDeleteResponses = vi.fn();
const dummyUpdateResponse = vi.fn();
const dummySetSelectedResponseId = vi.fn();

// Mock internal components to return identifiable elements
vi.mock("./components/SingleResponseCardHeader", () => ({
  SingleResponseCardHeader: (props: any) => (
    <div data-testid="SingleResponseCardHeader">
      <button onClick={() => props.setDeleteDialogOpen(true)}>Open Delete</button>
    </div>
  ),
}));
vi.mock("./components/SingleResponseCardBody", () => ({
  SingleResponseCardBody: () => <div data-testid="SingleResponseCardBody">Body Content</div>,
}));
vi.mock("./components/ResponseTagsWrapper", () => ({
  ResponseTagsWrapper: (props: any) => (
    <div data-testid="ResponseTagsWrapper">
      <button onClick={() => props.updateFetchedResponses()}>Update Responses</button>
    </div>
  ),
}));
vi.mock("@/modules/ui/components/delete-dialog", () => ({
  DeleteDialog: ({ open, onDelete }: any) =>
    open ? (
      <button data-testid="DeleteDialog" onClick={() => onDelete()}>
        Confirm Delete
      </button>
    ) : null,
}));
vi.mock("./components/ResponseNote", () => ({
  ResponseNotes: (props: any) => <div data-testid="ResponseNotes">Notes ({props.notes.length})</div>,
}));

vi.mock("./actions", () => ({
  deleteResponseAction: vi.fn().mockResolvedValue("deletedResponse"),
  getResponseAction: vi.fn(),
}));

vi.mock("./util", () => ({
  isValidValue: (value: any) => value !== null && value !== undefined,
}));

describe("SingleResponseCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders as a plain div when survey is draft and isReadOnly", () => {
    const draftSurvey = { ...dummySurvey, status: "draft" } as TSurvey;
    render(
      <SingleResponseCard
        survey={draftSurvey}
        response={dummyResponse}
        user={dummyUser}
        pageType="response"
        environmentTags={[]}
        environment={dummyEnvironment}
        updateResponse={dummyUpdateResponse}
        deleteResponses={dummyDeleteResponses}
        isReadOnly={true}
        setSelectedResponseId={dummySetSelectedResponseId}
        locale={dummyLocale}
      />
    );

    expect(screen.getByTestId("SingleResponseCardHeader")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("calls deleteResponseAction and refreshes router on successful deletion", async () => {
    render(
      <SingleResponseCard
        survey={dummySurvey}
        response={dummyResponse}
        user={dummyUser}
        pageType="response"
        environmentTags={[]}
        environment={dummyEnvironment}
        updateResponse={dummyUpdateResponse}
        deleteResponses={dummyDeleteResponses}
        isReadOnly={false}
        setSelectedResponseId={dummySetSelectedResponseId}
        locale={dummyLocale}
      />
    );

    userEvent.click(screen.getByText("Open Delete"));

    const deleteButton = await screen.findByTestId("DeleteDialog");
    await userEvent.click(deleteButton);
    await waitFor(() => {
      expect(deleteResponseAction).toHaveBeenCalledWith({ responseId: dummyResponse.id });
    });

    expect(dummyDeleteResponses).toHaveBeenCalledWith([dummyResponse.id]);
  });

  it("calls toast.error when deleteResponseAction throws error", async () => {
    vi.mocked(deleteResponseAction).mockRejectedValueOnce(new Error("Delete failed"));
    render(
      <SingleResponseCard
        survey={dummySurvey}
        response={dummyResponse}
        user={dummyUser}
        pageType="response"
        environmentTags={[]}
        environment={dummyEnvironment}
        updateResponse={dummyUpdateResponse}
        deleteResponses={dummyDeleteResponses}
        isReadOnly={false}
        setSelectedResponseId={dummySetSelectedResponseId}
        locale={dummyLocale}
      />
    );
    await userEvent.click(screen.getByText("Open Delete"));
    const deleteButton = await screen.findByTestId("DeleteDialog");
    await userEvent.click(deleteButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Delete failed");
    });
  });

  it("calls updateResponse when getResponseAction returns updated response", async () => {
    vi.mocked(getResponseAction).mockResolvedValueOnce({ data: { updated: true } as any });
    render(
      <SingleResponseCard
        survey={dummySurvey}
        response={dummyResponse}
        user={dummyUser}
        pageType="response"
        environmentTags={[]}
        environment={dummyEnvironment}
        updateResponse={dummyUpdateResponse}
        deleteResponses={dummyDeleteResponses}
        isReadOnly={false}
        setSelectedResponseId={dummySetSelectedResponseId}
        locale={dummyLocale}
      />
    );

    expect(screen.getByTestId("ResponseTagsWrapper")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Update Responses"));

    await waitFor(() => {
      expect(getResponseAction).toHaveBeenCalledWith({ responseId: dummyResponse.id });
    });

    await waitFor(() => {
      expect(dummyUpdateResponse).toHaveBeenCalledWith(dummyResponse.id, { updated: true });
    });
  });
});
