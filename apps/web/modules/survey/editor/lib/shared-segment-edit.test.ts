import { describe, expect, test } from "vitest";
import type { TBaseFilters, TSegment } from "@formbricks/types/segment";
import {
  type TSharedSegmentEdit,
  hasUnsavedSharedSegmentEdit,
  withSavedSharedSegmentFilters,
} from "./shared-segment-edit";

const savedFilters: TBaseFilters = [];
const editedFilters = [
  {
    id: "clfilter0000000000000001",
    connector: null,
    resource: {
      id: "clfilterres0000000000001",
      root: { type: "attribute", contactAttributeKey: "email" },
      qualifier: { operator: "equals" },
      value: "a@b.co",
    },
  },
] as TBaseFilters;

const shared: TSegment = {
  id: "clsharedsegment000000001",
  title: "Clone of Power users",
  description: null,
  isPrivate: false,
  filters: editedFilters,
  workspaceId: "clworkspace0000000000001",
  surveys: ["clsurvey0000000000000001"],
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const edit: TSharedSegmentEdit = { segmentId: shared.id, savedFilters };

describe("hasUnsavedSharedSegmentEdit", () => {
  test("a shared segment whose filters differ from the open edit's stored filters is unsaved", () => {
    expect(hasUnsavedSharedSegmentEdit(shared, edit)).toBe(true);
  });

  test("filters back as stored are not unsaved", () => {
    expect(hasUnsavedSharedSegmentEdit({ ...shared, filters: [] }, edit)).toBe(false);
  });

  test.each<[string, TSegment | null, TSharedSegmentEdit | null]>([
    ["no open edit", shared, null],
    ["no segment", null, edit],
    ["another segment", { ...shared, id: "clothersegment0000000001" }, edit],
    ["a private segment, which the survey save writes", { ...shared, isPrivate: true }, edit],
  ])("%s is not an unsaved shared-segment edit", (_case, segment, openEdit) => {
    expect(hasUnsavedSharedSegmentEdit(segment, openEdit)).toBe(false);
  });
});

describe("withSavedSharedSegmentFilters", () => {
  const survey = { name: "Edited", segment: shared };

  test("an unsaved edit goes out with its stored filters, and the other edits as they are", () => {
    expect(withSavedSharedSegmentFilters(survey, edit)).toEqual({
      name: "Edited",
      segment: { ...shared, filters: savedFilters },
    });
  });

  test("a survey without an unsaved edit goes out as is", () => {
    expect(withSavedSharedSegmentFilters(survey, null)).toBe(survey);
    const segmentless = { name: "Edited", segment: null };
    expect(withSavedSharedSegmentFilters(segmentless, edit)).toBe(segmentless);
  });
});
