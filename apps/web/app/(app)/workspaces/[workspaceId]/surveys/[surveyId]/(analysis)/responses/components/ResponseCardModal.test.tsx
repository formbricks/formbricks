import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { ResponseCardModal } from "./ResponseCardModal";

vi.mock("@/modules/analysis/components/SingleResponseCard", () => ({
  SingleResponseCard: ({ response }: Readonly<{ response: TResponse }>) => <div>response {response.id}</div>,
}));

const responses = [{ id: "r1" }, { id: "r2" }, { id: "r3" }] as unknown as TResponse[];

// Mirrors ResponseTable: the modal is open while a response is selected.
const Harness = () => {
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelectedResponseId("r2");
          setOpen(true);
        }}>
        open r2
      </button>
      <ResponseCardModal
        responses={responses}
        selectedResponseId={selectedResponseId}
        setSelectedResponseId={setSelectedResponseId}
        survey={{} as TSurvey}
        environmentTags={[]}
        updateResponse={vi.fn()}
        updateResponseList={vi.fn()}
        isReadOnly={false}
        open={open}
        setOpen={setOpen}
        locale="en-US"
      />
    </>
  );
};

const navButtons = () => {
  const buttons = screen.getAllByRole("button").filter((button) => button.textContent === "");
  return { back: buttons.at(-2)!, next: buttons.at(-1)! };
};

describe("ResponseCardModal", () => {
  afterEach(() => cleanup());

  test("reopening the response a Next click left from keeps Back and Next enabled", () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("open r2"));
    fireEvent.click(navButtons().next);
    expect(screen.getByText("response r3")).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(screen.queryByText("response r3")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("open r2"));
    expect(screen.getByText("response r2")).toBeInTheDocument();
    const { back, next } = navButtons();
    expect(back).toBeEnabled();
    expect(next).toBeEnabled();
  });
});
