import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TPreselections } from "@formbricks/types/surveys/preselect-answer";
import {
  addPreselections,
  createPreselectionState,
  openPage,
  recordSubmit,
  undoSubmit,
} from "./preselection-state";

/**
 * Back undoes a pre-selection with the submit that made it (ENG-7437): page 1's rule ("plan is
 * Business") pre-selects "Open/Pending" in "status", on page 2.
 */

const status = {
  id: "status",
  type: TSurveyElementTypeEnum.MultipleChoiceSingle,
  headline: { default: "Inquiry status" },
  required: false,
  choices: [
    { id: "open", label: { default: "Open/Pending" } },
    { id: "closed", label: { default: "Closed" } },
  ],
};
const page2 = { elements: [status] } as unknown as Parameters<typeof openPage>[1];
const ruleFired: TPreselections = { status: { type: "choices", choiceIds: ["open"] } };

/** Page 1 submitted with the rule matching, then page 2 opened. */
const onPage2 = () => {
  const submitted = recordSubmit(createPreselectionState(), ["plan"], ruleFired);
  return openPage(submitted, page2, {}, "default");
};

describe("pre-selections across Back", () => {
  test("a page opens with its pre-selection once, then it is the respondent's to change", () => {
    const { data, state } = onPage2();

    expect(data).toEqual({ status: "Open/Pending" });
    expect(state.pending).toEqual({});
    // Opening it again (Back to it later) pre-selects nothing over the respondent's answer.
    expect(openPage(state, page2, { status: "Closed" }, "default").data).toEqual({});
  });

  test("Back before the page is submitted undoes an untouched pre-selection, so a changed answer that no longer matches leaves it empty", () => {
    const { data, state } = onPage2();
    const answers = { plan: "Business", ...data };

    const undone = undoSubmit(state, answers);
    expect(undone.dropElementIds).toEqual(["status"]);

    // The respondent changes page 1 to "Personal": the rule doesn't match, so nothing is pre-selected.
    const resubmitted = recordSubmit(undone.state, ["plan"], {});
    expect(openPage(resubmitted, page2, {}, "default").data).toEqual({});
  });

  test("Back keeps a pre-selection the respondent changed: it is their answer", () => {
    const { state } = onPage2();

    expect(undoSubmit(state, { plan: "Business", status: "Closed" }).dropElementIds).toEqual([]);
  });

  test("a submitted page's answers are the respondent's, and Back never drops them", () => {
    const { data, state } = onPage2();
    // Page 2 submitted as it opened, then Back from page 3 and from page 2.
    const afterPage2 = recordSubmit(state, ["status"], {});
    const backToPage2 = undoSubmit(afterPage2, data);
    const backToPage1 = undoSubmit(backToPage2.state, data);

    expect(backToPage2.dropElementIds).toEqual([]);
    expect(backToPage1.dropElementIds).toEqual([]);
  });

  test("pre-selections from blocks passed over on entry have no step to undo", () => {
    const state = addPreselections(createPreselectionState(), ruleFired);

    expect(state.steps).toEqual([]);
    expect(undoSubmit(state, {})).toEqual({ state, dropElementIds: [] });
    expect(openPage(state, page2, {}, "default").data).toEqual({ status: "Open/Pending" });
  });

  test("the state is plain JSON, so offline progress stores and restores it", () => {
    const { state } = onPage2();

    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe("pre-selections a later page opened with", () => {
  test("Back past the page undoes one an earlier submit made, so a different rule on the page in between wins", () => {
    // Page 1 pre-selects "Open/Pending" for page 3; page 2 has no rule for it; page 3 opens with it.
    const afterPage1 = recordSubmit(createPreselectionState(), ["plan"], ruleFired);
    const afterPage2 = recordSubmit(afterPage1, ["reason"], {});
    const opened = openPage(afterPage2, page2, {}, "default");
    expect(opened.data).toEqual({ status: "Open/Pending" });

    // Back from page 3 undoes page 2's submit, and with it what page 3 opened with.
    const back = undoSubmit(opened.state, { plan: "Business", reason: "x", ...opened.data });
    expect(back.dropElementIds).toEqual(["status"]);

    // Page 2 now pre-selects "Closed": page 3 opens with it, not with the stale "Open/Pending".
    const resubmitted = recordSubmit(back.state, ["reason"], {
      status: { type: "choices", choiceIds: ["closed"] },
    });
    expect(openPage(resubmitted, page2, {}, "default").data).toEqual({ status: "Closed" });
  });
});
