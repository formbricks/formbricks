import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TAiDraftState } from "@/modules/survey/components/template-list/lib/ai-draft-reducer";
import { AiDraftPreview } from "./ai-draft-preview";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/modules/survey/lib/elements", () => ({
  getElementIconMap: () => ({}),
  getElementNameMap: () => ({}),
}));

const makeDraft = (count: number): TAiDraftState => ({
  name: "Draft",
  questions: Array.from({ length: count }, (_, index) => ({
    key: `q${index}`,
    blockKey: "b1",
    type: "openText",
    headline: `Question ${index + 1}`,
  })),
});

const getList = () => screen.getByRole("region", { name: "workspace.surveys.ai_create.draft_survey" });

describe("AiDraftPreview scrolling", () => {
  let scrollTo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scrollTo });
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => 1000 });
  });

  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
    delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
  });

  test("follows new questions down while generating", () => {
    const { rerender } = render(<AiDraftPreview draft={makeDraft(1)} isGenerating />);
    scrollTo.mockClear();

    rerender(<AiDraftPreview draft={makeDraft(2)} isGenerating />);

    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: "smooth" });
  });

  test("scrolls back to the first question when generation ends", () => {
    const { rerender } = render(<AiDraftPreview draft={makeDraft(3)} isGenerating />);
    scrollTo.mockClear();

    rerender(<AiDraftPreview draft={makeDraft(3)} isGenerating={false} />);

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });

  test("a draft that lands all at once is not scrolled to the end", () => {
    render(<AiDraftPreview draft={makeDraft(10)} isGenerating={false} />);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  test("a new generation re-pins after the user scrolled away", () => {
    const { rerender } = render(<AiDraftPreview draft={makeDraft(3)} isGenerating />);
    const list = getList();
    // Scrolled up, far from the bottom: no longer following.
    Object.defineProperty(list, "scrollTop", { configurable: true, value: 0 });
    Object.defineProperty(list, "clientHeight", { configurable: true, value: 200 });
    list.dispatchEvent(new Event("scroll"));

    rerender(<AiDraftPreview draft={makeDraft(4)} isGenerating />);
    rerender(<AiDraftPreview draft={makeDraft(4)} isGenerating={false} />);
    scrollTo.mockClear();

    rerender(<AiDraftPreview draft={makeDraft(1)} isGenerating />);

    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: "smooth" });
  });
});
