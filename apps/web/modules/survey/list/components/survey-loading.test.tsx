import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { SurveyLoading } from "./survey-loading";

describe("SurveyLoading", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the loading skeleton with correct structure and styles", () => {
    const { container } = render(<SurveyLoading />);

    // Check for the main container
    const mainDiv = container.firstChild;
    expect(mainDiv).toBeInTheDocument();
    expect(mainDiv).toHaveClass("grid h-full w-full animate-pulse place-content-stretch gap-4");

    // Check for the 5 loading items
    if (!mainDiv) throw new Error("Main div not found");
    const loadingItems = mainDiv.childNodes;
    expect(loadingItems.length).toBe(5);

    loadingItems.forEach((item) => {
      expect(item).toHaveClass(
        "relative flex h-16 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all ease-in-out"
      );

      // Check inner structure of each item
      const innerFlexDiv = item.firstChild;
      expect(innerFlexDiv).toBeInTheDocument();
      expect(innerFlexDiv).toHaveClass("flex w-full items-center justify-between");

      if (!innerFlexDiv) throw new Error("Inner div not found");
      const placeholders = innerFlexDiv.childNodes;
      expect(placeholders.length).toBe(7);

      // Check classes for each placeholder
      expect(placeholders[0]).toHaveClass("h-4 w-32 rounded-xl bg-slate-400");
      expect(placeholders[1]).toHaveClass("h-4 w-20 rounded-xl bg-slate-200");
      expect(placeholders[2]).toHaveClass("h-4 w-20 rounded-xl bg-slate-200");
      expect(placeholders[3]).toHaveClass("h-4 w-20 rounded-xl bg-slate-200");
      expect(placeholders[4]).toHaveClass("h-4 w-20 rounded-xl bg-slate-200");
      expect(placeholders[5]).toHaveClass("h-4 w-20 rounded-xl bg-slate-200");
      expect(placeholders[6]).toHaveClass("h-8 w-8 rounded-md bg-slate-300");
    });
  });
});
