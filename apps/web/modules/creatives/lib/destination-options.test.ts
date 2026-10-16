import { describe, expect, test } from "vitest";
import { type TDestinationSurveyCandidate, toDestinationSurveyOptions } from "./destination-options";

const survey = (
  patch: Partial<TDestinationSurveyCandidate> & { id: string }
): TDestinationSurveyCandidate => ({
  name: `Survey ${patch.id}`,
  type: "app",
  status: "inProgress",
  archivedAt: null,
  singleUse: { enabled: false, isEncrypted: true },
  pin: null,
  visibility: "workspace",
  visibilityVersion: 0,
  visibilityProjectedVersion: 0,
  ...patch,
});

describe("toDestinationSurveyOptions", () => {
  test("offers workspace-visible surveys of either type and any status, in the order given", () => {
    const options = toDestinationSurveyOptions(
      [
        survey({ id: "app", name: "Site feedback" }),
        survey({ id: "link", name: "Plan finder", type: "link", status: "draft" }),
      ],
      null
    );

    expect(options).toEqual([
      { id: "app", name: "Site feedback", type: "app", status: "inProgress", visibility: "workspace" },
      { id: "link", name: "Plan finder", type: "link", status: "draft", visibility: "workspace" },
    ]);
  });

  test("lists Restricted surveys by their effective visibility, a pending visibility change included", () => {
    const options = toDestinationSurveyOptions(
      [
        survey({ id: "restricted", visibility: "restricted" }),
        survey({
          id: "pending",
          visibility: "workspace",
          visibilityVersion: 2,
          visibilityProjectedVersion: 1,
        }),
      ],
      null
    );

    expect(options.map(({ id, visibility }) => ({ id, visibility }))).toEqual([
      { id: "restricted", visibility: "restricted" },
      { id: "pending", visibility: "restricted" },
    ]);
  });

  test("leaves out single-use, PIN-protected and archived surveys", () => {
    const options = toDestinationSurveyOptions(
      [
        survey({ id: "single-use", type: "link", singleUse: { enabled: true, isEncrypted: true } }),
        survey({ id: "pin", type: "link", pin: "1234" }),
        survey({ id: "restricted-pin", type: "link", pin: "1234", visibility: "restricted" }),
        survey({ id: "archived", archivedAt: new Date("2026-10-01T00:00:00.000Z") }),
        survey({ id: "ok" }),
      ],
      null
    );

    expect(options.map(({ id }) => id)).toEqual(["ok"]);
  });

  test("always keeps the survey the creative already opens, once", () => {
    const linked = survey({ id: "linked", archivedAt: new Date("2026-10-01T00:00:00.000Z") });
    const options = toDestinationSurveyOptions([survey({ id: "ok" }), linked, linked], "linked");

    expect(options.map(({ id }) => id)).toEqual(["ok", "linked"]);
  });
});
