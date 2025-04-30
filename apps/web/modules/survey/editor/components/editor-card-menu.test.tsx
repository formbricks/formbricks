import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EditorCardMenu } from "./editor-card-menu";

describe("EditorCardMenu", () => {
  afterEach(() => {
    cleanup();
  });

  test("should move the card up when the 'Move Up' button is clicked and the card is not the first one", async () => {
    const moveCard = vi.fn();
    const cardIdx = 1;

    render(
      <EditorCardMenu
        survey={{ questions: [] } as any}
        cardIdx={cardIdx}
        lastCard={false}
        duplicateCard={vi.fn()}
        deleteCard={vi.fn()}
        moveCard={moveCard}
        card={{ type: "openText" } as any}
        updateCard={vi.fn()}
        addCard={vi.fn()}
        cardType="question"
      />
    );

    const moveUpButton = screen.getAllByRole("button")[0];
    await userEvent.click(moveUpButton);

    expect(moveCard).toHaveBeenCalledWith(cardIdx, true);
  });

  test("should move the card down when the 'Move Down' button is clicked and the card is not the last one", async () => {
    const moveCard = vi.fn();
    const cardIdx = 0;

    render(
      <EditorCardMenu
        survey={{ questions: [] } as any}
        cardIdx={cardIdx}
        lastCard={false}
        duplicateCard={vi.fn()}
        deleteCard={vi.fn()}
        moveCard={moveCard}
        card={{ type: "openText" } as any}
        updateCard={vi.fn()}
        addCard={vi.fn()}
        cardType="question"
      />
    );

    const moveDownButton = screen.getAllByRole("button")[1];
    await userEvent.click(moveDownButton);

    expect(moveCard).toHaveBeenCalledWith(cardIdx, false);
  });

  test("should duplicate the card when the 'Duplicate' button is clicked", async () => {
    const duplicateCard = vi.fn();
    const cardIdx = 1;

    render(
      <EditorCardMenu
        survey={{ questions: [] } as any}
        cardIdx={cardIdx}
        lastCard={false}
        duplicateCard={duplicateCard}
        deleteCard={vi.fn()}
        moveCard={vi.fn()}
        card={{ type: "openText" } as any}
        updateCard={vi.fn()}
        addCard={vi.fn()}
        cardType="question"
      />
    );

    const duplicateButton = screen.getAllByRole("button")[2];
    await userEvent.click(duplicateButton);

    expect(duplicateCard).toHaveBeenCalledWith(cardIdx);
  });

  test("should disable the delete button when the card is the only one left in the survey", () => {
    const survey = {
      questions: [{ id: "1", type: "openText" }],
      type: "link",
      endings: [],
    } as any;

    render(
      <EditorCardMenu
        survey={survey}
        cardIdx={0}
        lastCard={true}
        duplicateCard={vi.fn()}
        deleteCard={vi.fn()}
        moveCard={vi.fn()}
        card={survey.questions[0]}
        updateCard={vi.fn()}
        addCard={vi.fn()}
        cardType="question"
      />
    );

    // Find the button with the trash icon (4th button in the menu)
    const deleteButton = screen.getAllByRole("button")[3];
    expect(deleteButton).toBeDisabled();
  });

  test("should disable 'Move Up' button when the card is the first card", () => {
    const moveCard = vi.fn();
    const cardIdx = 0;

    render(
      <EditorCardMenu
        survey={{ questions: [] } as any}
        cardIdx={cardIdx}
        lastCard={false}
        duplicateCard={vi.fn()}
        deleteCard={vi.fn()}
        moveCard={moveCard}
        card={{ type: "openText" } as any}
        updateCard={vi.fn()}
        addCard={vi.fn()}
        cardType="question"
      />
    );

    const moveUpButton = screen.getAllByRole("button")[0];
    expect(moveUpButton).toBeDisabled();
  });

  test("should disable 'Move Down' button when the card is the last card", () => {
    const moveCard = vi.fn();
    const cardIdx = 1;
    const lastCard = true;

    render(
      <EditorCardMenu
        survey={{ questions: [] } as any}
        cardIdx={cardIdx}
        lastCard={lastCard}
        duplicateCard={vi.fn()}
        deleteCard={vi.fn()}
        moveCard={moveCard}
        card={{ type: "openText" } as any}
        updateCard={vi.fn()}
        addCard={vi.fn()}
        cardType="question"
      />
    );

    const moveDownButton = screen.getAllByRole("button")[1];
    expect(moveDownButton).toBeDisabled();
  });
});
