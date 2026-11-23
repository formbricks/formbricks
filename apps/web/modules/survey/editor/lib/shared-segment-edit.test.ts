import { describe, expect, test } from "vitest";
import type { TBaseFilters, TSegment } from "@formbricks/types/segment";
import {
  type TSharedSegmentEdit,
  hasUnsavedSharedSegmentEdit,
  isSaveBlockedBySharedSegmentEdit,
  keepSharedSegmentEditFor,
  startSharedSegmentEdit,
  withSavedSharedSegment,
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

describe("withSavedSharedSegment", () => {
  const survey = { name: "Edited", segment: shared };
  // As stored: no edit, and a shape the card's copy can lack or add to (Clone adds counts).
  const persisted: TSegment = { ...shared, filters: savedFilters, updatedAt: new Date(1) };

  test("an open edit goes out as the stored segment, and the other edits as they are", () => {
    expect(withSavedSharedSegment(survey, edit, persisted)).toEqual({ name: "Edited", segment: persisted });
  });

  test("an open edit without changes also goes out as stored, so it alone is no change to save", () => {
    const untouched = { name: "Edited", segment: { ...shared, filters: savedFilters } };
    expect(withSavedSharedSegment(untouched, edit, persisted).segment).toBe(persisted);
  });

  test("a last save with older filters (before a 'Save changes') does not go out; only the filters go back", () => {
    const stale = { ...persisted, filters: editedFilters };
    const openedOnSaved = { segmentId: shared.id, savedFilters: [] };
    const edited = { name: "Edited", segment: { ...shared, filters: [...editedFilters, ...editedFilters] } };
    expect(withSavedSharedSegment(edited, openedOnSaved, stale).segment).toEqual({
      ...edited.segment,
      filters: [],
    });
  });

  test("before the last save knows the segment (right after Clone or Load), only the filters go back", () => {
    const other = { ...persisted, id: "clothersegment0000000001" };
    expect(withSavedSharedSegment(survey, edit, other)).toEqual({
      name: "Edited",
      segment: { ...shared, filters: savedFilters },
    });
  });

  test.each<[string, { name: string; segment: TSegment | null }, TSharedSegmentEdit | null]>([
    ["no open edit", survey, null],
    ["no segment", { name: "Edited", segment: null }, edit],
    ["another segment", { name: "Edited", segment: { ...shared, id: "clothersegment0000000001" } }, edit],
    ["a private segment", { name: "Edited", segment: { ...shared, isPrivate: true } }, edit],
  ])("%s goes out as is", (_case, workingCopy, openEdit) => {
    expect(withSavedSharedSegment(workingCopy, openEdit, persisted)).toBe(workingCopy);
  });
});

describe("startSharedSegmentEdit", () => {
  test("Edit segment starts an edit with the filters the segment has now", () => {
    expect(startSharedSegmentEdit(null, shared)).toEqual({
      segmentId: shared.id,
      savedFilters: shared.filters,
    });
  });

  test("an edit already open for the segment (editor closed by a failed Load) keeps its filters", () => {
    expect(startSharedSegmentEdit(edit, shared)).toBe(edit);
  });

  test("a private segment, which the survey save writes, starts none", () => {
    expect(startSharedSegmentEdit(null, { ...shared, isPrivate: true })).toBeNull();
  });

  test("an edit of another segment is replaced", () => {
    const other = { ...shared, id: "clothersegment0000000001" };
    expect(startSharedSegmentEdit(edit, other)).toEqual({ segmentId: other.id, savedFilters: other.filters });
  });
});

describe("keepSharedSegmentEditFor", () => {
  test("the edit stays while the survey is on its segment", () => {
    expect(keepSharedSegmentEditFor(edit, shared.id)).toBe(edit);
  });

  test("the survey moving to another segment (Load, Clone, Reset) ends the edit", () => {
    expect(keepSharedSegmentEditFor(edit, "clothersegment0000000001")).toBeNull();
    expect(keepSharedSegmentEditFor(edit, undefined)).toBeNull();
  });
});

describe("isSaveBlockedBySharedSegmentEdit", () => {
  test("an app survey with an unsaved shared-segment edit is blocked", () => {
    expect(isSaveBlockedBySharedSegmentEdit({ type: "app", segment: shared }, edit)).toBe(true);
  });

  test("a survey switched to link is not: its save leaves the segment, and no card can save it", () => {
    expect(isSaveBlockedBySharedSegmentEdit({ type: "link", segment: shared }, edit)).toBe(false);
  });

  test("an app survey without unsaved filters is not", () => {
    expect(isSaveBlockedBySharedSegmentEdit({ type: "app", segment: { ...shared, filters: [] } }, edit)).toBe(
      false
    );
  });
});
