import { describe, expect, test } from "vitest";
import { HUB_EMOTION_VALUES, HUB_SENTIMENT_VALUES, ZHubEmotion, ZHubSentiment } from "./feedback-source";

describe("Hub enrichment vocabularies", () => {
  test("the sentiment filter schema accepts exactly the shared sentiment tuple, in its order", () => {
    expect(ZHubSentiment.options).toEqual([...HUB_SENTIMENT_VALUES]);
  });

  test("the emotion filter schema accepts exactly the shared emotion tuple, in its order", () => {
    expect(ZHubEmotion.options).toEqual([...HUB_EMOTION_VALUES]);
  });
});
