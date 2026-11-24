import type { TSurvey } from "@formbricks/types/surveys/types";

/**
 * ENG-6957: whether `segment` is the survey's own private segment: the one it is targeted with, private,
 * and used by no other survey. It is the only segment a survey save writes — and the only one a v3 survey
 * PATCH may write (ENG-7269). A shared segment changes the targeting of every survey that uses it, so it
 * is edited through the segment endpoints, which hold `workspace.write` and check each survey
 * (`PATCH /api/internal/segments/{segmentId}`).
 */
export const isOwnPrivateSegment = (
  survey: Pick<TSurvey, "id" | "segment">,
  segmentId: string
): survey is Pick<TSurvey, "id"> & { segment: NonNullable<TSurvey["segment"]> } =>
  !!survey.segment &&
  survey.segment.id === segmentId &&
  survey.segment.isPrivate &&
  survey.segment.surveys.every((connectedId) => connectedId === survey.id);
