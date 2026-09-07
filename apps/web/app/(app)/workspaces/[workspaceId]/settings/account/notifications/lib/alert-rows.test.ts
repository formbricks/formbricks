import { describe, expect, test } from "vitest";
import { getAlertRows } from "./alert-rows";

const workspace = (name: string, surveys: { id: string; name: string }[]) => ({ id: name, name, surveys });

describe("getAlertRows", () => {
  test("names the workspace on every survey row", () => {
    const rows = getAlertRows([
      workspace("Website", [{ id: "s1", name: "NPS Survey" }]),
      workspace("Mobile App", [{ id: "s2", name: "Churn Survey" }]),
    ]);

    expect(rows).toEqual([
      { surveyId: "s2", surveyName: "Churn Survey", workspaceName: "Mobile App" },
      { surveyId: "s1", surveyName: "NPS Survey", workspaceName: "Website" },
    ]);
  });

  test("keeps a workspace's surveys together when the input interleaves them", () => {
    // What the page's own query returns: no `orderBy` on either level, so a second workspace can sit
    // between two surveys that belong to the same one.
    const rows = getAlertRows([
      workspace("Website", [{ id: "s1", name: "NPS Survey" }]),
      workspace("Docs Portal", [{ id: "s2", name: "Onboarding Feedback" }]),
      workspace("Website", [{ id: "s3", name: "Churn Survey" }]),
    ]);

    expect(rows.map((row) => [row.workspaceName, row.surveyName])).toEqual([
      ["Docs Portal", "Onboarding Feedback"],
      ["Website", "Churn Survey"],
      ["Website", "NPS Survey"],
    ]);
  });

  test("orders same-named surveys in one workspace by id, so their rows cannot swap", () => {
    const duplicates = [
      { id: "s2", name: "NPS Survey" },
      { id: "s1", name: "NPS Survey" },
    ];

    expect(getAlertRows([workspace("Website", duplicates)]).map((row) => row.surveyId)).toEqual(["s1", "s2"]);
    expect(
      getAlertRows([workspace("Website", [...duplicates].reverse())]).map((row) => row.surveyId)
    ).toEqual(["s1", "s2"]);
  });

  test("orders numbered workspaces the way a reader counts them", () => {
    const rows = getAlertRows([
      workspace("Workspace 10", [{ id: "s1", name: "NPS Survey" }]),
      workspace("Workspace 2", [{ id: "s2", name: "NPS Survey" }]),
    ]);

    expect(rows.map((row) => row.workspaceName)).toEqual(["Workspace 2", "Workspace 10"]);
  });

  test("returns no rows for an organization whose workspaces hold no surveys", () => {
    expect(getAlertRows([workspace("Website", []), workspace("Mobile App", [])])).toEqual([]);
  });
});
