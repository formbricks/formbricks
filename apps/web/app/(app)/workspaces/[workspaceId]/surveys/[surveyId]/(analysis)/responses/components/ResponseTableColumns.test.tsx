import { cleanup, render, screen } from "@testing-library/react";
import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TResponseTableData } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { generateResponseTableColumns } from "./ResponseTableColumns";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const t = ((key: string) => key) as unknown as TFunction;

type TPersonCell = (context: { row: { original: TResponseTableData } }) => ReactNode;

const renderPersonCell = (person: TResponseTableData["person"]) => {
  const survey = {
    id: "survey-1",
    blocks: [],
    hiddenFields: { enabled: false, fieldIds: [] },
    variables: [],
  } as unknown as TSurvey;
  const column = generateResponseTableColumns(survey, false, true, "en-US", t, false).find(
    (candidate) => "accessorKey" in candidate && candidate.accessorKey === "personId"
  );
  const cell = column?.cell as TPersonCell;
  const original = {
    person,
    contactAttributes: { email: "saved@example.com" },
  } as unknown as TResponseTableData;
  render(<>{cell({ row: { original } })}</>);
};

describe("ResponseTableColumns › person", () => {
  afterEach(cleanup);

  test("shows the identifier of a contact the workspace reaches", () => {
    renderPersonCell({ id: "contact-1", userId: "user-1" });

    expect(screen.getByText("saved@example.com")).toBeInTheDocument();
    expect(screen.queryByText("workspace.surveys.responses.contact_not_available")).not.toBeInTheDocument();
  });

  test("marks a contact the workspace no longer reaches as not available", () => {
    renderPersonCell({ id: "contact-1", unavailable: true });

    expect(screen.getByText("saved@example.com")).toBeInTheDocument();
    expect(screen.getByText("workspace.surveys.responses.contact_not_available")).toBeInTheDocument();
  });
});
