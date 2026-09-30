import { describe, expect, test, vi } from "vitest";
import { SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE as SERVER_MESSAGE } from "@/lib/survey/visibility/outbound";
import {
  SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE,
  hasRestrictedAttachedSurvey,
  isRestrictedSurveyPick,
  isSurveyNotWorkspaceVisibleMessage,
} from "./outbound";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: {} }));
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: vi.fn() }));

const restricted = { id: "s1", visibility: "restricted" as const };
const visible = { id: "s2", visibility: "workspace" as const };

describe("isRestrictedSurveyPick", () => {
  test("refuses a new restricted survey while the gate is on", () => {
    expect(isRestrictedSurveyPick(true, restricted)).toBe(true);
    expect(isRestrictedSurveyPick(true, visible)).toBe(false);
  });

  test("keeps a restricted survey already on the connection selectable, so it can be removed", () => {
    expect(isRestrictedSurveyPick(true, restricted, ["s1"])).toBe(false);
  });

  test("never refuses with the gate off or without visibility data", () => {
    expect(isRestrictedSurveyPick(false, restricted)).toBe(false);
    expect(isRestrictedSurveyPick(true, { id: "s3" })).toBe(false);
  });
});

describe("effective visibility of stored surveys", () => {
  // A stored survey whose grant is still settling already reads `workspace`, but the server keeps
  // refusing it until the graph catches up — so the picker refuses it too.
  const pendingGrant = {
    id: "s4",
    visibility: "workspace" as const,
    visibilityVersion: 2,
    visibilityProjectedVersion: 1,
  };
  const settled = {
    id: "s5",
    visibility: "workspace" as const,
    visibilityVersion: 2,
    visibilityProjectedVersion: 2,
  };

  test("treats a change still in flight as restricted", () => {
    expect(isRestrictedSurveyPick(true, pendingGrant)).toBe(true);
    expect(hasRestrictedAttachedSurvey(true, ["s4"], [pendingGrant])).toBe(true);
  });

  test("offers a never-projected workspace survey, which the server already treats as visible", () => {
    const neverProjected = {
      id: "s6",
      visibility: "workspace" as const,
      visibilityVersion: 1,
      visibilityProjectedVersion: 0,
    };
    expect(isRestrictedSurveyPick(true, neverProjected)).toBe(false);
  });

  test("offers the survey once the change has settled", () => {
    expect(isRestrictedSurveyPick(true, settled)).toBe(false);
  });
});

describe("hasRestrictedAttachedSurvey", () => {
  test("is true when an attached survey is restricted", () => {
    expect(hasRestrictedAttachedSurvey(true, ["s1", "s2"], [restricted, visible])).toBe(true);
  });

  test("is false for visible surveys, an unattached restricted one, or no surveys (the wildcard)", () => {
    expect(hasRestrictedAttachedSurvey(true, ["s2"], [restricted, visible])).toBe(false);
    expect(hasRestrictedAttachedSurvey(true, [], [restricted])).toBe(false);
  });

  test("is false with the gate off", () => {
    expect(hasRestrictedAttachedSurvey(false, ["s1"], [restricted])).toBe(false);
  });
});

describe("isSurveyNotWorkspaceVisibleMessage", () => {
  test("stays in step with the server's wording", () => {
    expect(SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE).toBe(SERVER_MESSAGE);
  });

  test("recognises the refusal, also inside a longer message", () => {
    expect(isSurveyNotWorkspaceVisibleMessage(SERVER_MESSAGE)).toBe(true);
    expect(isSurveyNotWorkspaceVisibleMessage(`Error: ${SERVER_MESSAGE}`)).toBe(true);
    expect(isSurveyNotWorkspaceVisibleMessage("Something else")).toBe(false);
    expect(isSurveyNotWorkspaceVisibleMessage(undefined)).toBe(false);
  });
});
