import { describe, expect, test } from "vitest";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { getCardStartsWithMedia } from "./card-header";

const survey = (overrides: Partial<TJsWorkspaceStateSurvey>): TJsWorkspaceStateSurvey =>
  ({
    welcomeCard: { enabled: true, timeToFinish: false, showResponseCount: false },
    blocks: [],
    endings: [],
    ...overrides,
  }) as unknown as TJsWorkspaceStateSurvey;

type TBlock = TJsWorkspaceStateSurvey["blocks"][number];

const element = (id: string, media: Record<string, string> = {}): Record<string, unknown> => ({
  id,
  type: "openText",
  headline: { default: "Q" },
  required: false,
  ...media,
});

const block = (id: string, ...elements: Record<string, unknown>[]): TBlock =>
  ({ id, name: id, elements }) as unknown as TBlock;

describe("getCardStartsWithMedia", () => {
  test("is true when the block's first element has an image or a video", () => {
    const s = survey({
      blocks: [
        block("img", element("q1", { imageUrl: "https://example.com/a.png" })),
        block("vid", element("q1", { videoUrl: "https://youtu.be/x" })),
      ],
    });
    expect(getCardStartsWithMedia(s, "img")).toBe(true);
    expect(getCardStartsWithMedia(s, "vid")).toBe(true);
  });

  test("ignores media on a later element of the block", () => {
    const withLaterMedia = block("b", {});
    withLaterMedia.elements.push({
      ...withLaterMedia.elements[0],
      id: "b-q2",
      imageUrl: "https://e.com/a.png",
    });
    const s = survey({ blocks: [withLaterMedia] as TJsWorkspaceStateSurvey["blocks"] });
    expect(getCardStartsWithMedia(s, "b")).toBe(false);
  });

  test("counts the welcome card's video but not its logo", () => {
    const logo = survey({
      welcomeCard: {
        enabled: true,
        fileUrl: "https://e.com/logo.png",
        timeToFinish: false,
        showResponseCount: false,
      },
    });
    const video = survey({
      welcomeCard: {
        enabled: true,
        videoUrl: "https://youtu.be/x",
        timeToFinish: false,
        showResponseCount: false,
      },
    });
    expect(getCardStartsWithMedia(logo, "start")).toBe(false);
    expect(getCardStartsWithMedia(video, "start")).toBe(true);
  });

  test("counts an end screen's media and never a redirect ending", () => {
    const s = survey({
      endings: [
        { id: "end", type: "endScreen", imageUrl: "https://e.com/a.png" },
        { id: "plain", type: "endScreen" },
        { id: "redirect", type: "redirectToUrl", url: "https://e.com" },
      ] as TJsWorkspaceStateSurvey["endings"],
    });
    expect(getCardStartsWithMedia(s, "end")).toBe(true);
    expect(getCardStartsWithMedia(s, "plain")).toBe(false);
    expect(getCardStartsWithMedia(s, "redirect")).toBe(false);
  });

  test("is false for an unknown card", () => {
    expect(getCardStartsWithMedia(survey({}), "missing")).toBe(false);
  });
});
