/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { OptionsType } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/components/response-filter-options";
import { useResponseTableFilters } from "./use-response-table-filters";

const navigation = vi.hoisted(() => ({ query: "" }));
const filterData = vi.hoisted(() => ({ resolve: true }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/app/(app)/workspaces/[workspaceId]/context/workspace-context", () => ({
  useOrganization: () => ({ organization: { displayTimeZone: "UTC" } }),
}));
vi.mock("@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/actions", () => ({
  getSurveyFilterDataAction: vi.fn(async () =>
    filterData.resolve
      ? {
          data: {
            environmentTags: [{ id: "tag1", name: "vip" }],
            attributes: { plan: ["Pro"] },
            reservedValues: {},
            hiddenFields: {},
            variableValues: {},
            quotas: [],
          },
        }
      : new Promise(() => undefined)
  ),
}));

const makeSurvey = (): TSurvey =>
  ({
    id: "survey1",
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    languages: [],
    blocks: [
      {
        id: "block1",
        name: "Block 1",
        elements: [
          {
            id: "plan",
            type: TSurveyElementTypeEnum.MultipleChoiceSingle,
            headline: { default: "Plan" },
            required: false,
            choices: [
              { id: "c1", label: { default: "Free" } },
              { id: "c2", label: { default: "Pro" } },
            ],
          },
        ],
      },
    ],
    hiddenFields: { enabled: false, fieldIds: [] },
    variables: [],
    embeddedDataFields: [],
  }) as unknown as TSurvey;

const setUrl = (query: string) => {
  navigation.query = query;
  globalThis.window.history.replaceState(null, "", query ? `/responses?${query}` : "/responses");
};

const render = (survey = makeSurvey()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(({ survey: current }) => useResponseTableFilters(current), {
    wrapper,
    initialProps: { survey },
  });
};

const liveFilters = () =>
  [...new URLSearchParams(globalThis.window.location.search).entries()].filter(([key]) =>
    key.startsWith("filter[")
  );

describe("useResponseTableFilters", () => {
  beforeEach(() => {
    filterData.resolve = true;
    setUrl("");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("reads the URL into the filter state the response pipeline reads", async () => {
    setUrl("filter%5Bstatus%5D%5Bin%5D=complete&filter%5Bquestion.plan%5D%5BincludesOneOf%5D=Pro");
    const { result } = render();

    await waitFor(() => expect(result.current.isFilterDataLoading).toBe(false));
    expect(result.current.selectedFilter.responseStatus).toBe("complete");
    expect(result.current.selectedFilter.filter).toEqual([
      expect.objectContaining({
        elementType: expect.objectContaining({ id: "plan", type: OptionsType.ELEMENTS }),
        filterType: { filterValue: "Includes either", filterComboBoxValue: ["Pro"] },
      }),
    ]);
  });

  test("keeps the same state while the filter is unchanged, even when the survey object is new", async () => {
    setUrl("filter%5Bquestion.plan%5D%5BincludesOneOf%5D=Pro");
    const { result, rerender } = render();
    await waitFor(() => expect(result.current.isFilterDataLoading).toBe(false));
    const { selectedFilter, dateRange } = result.current;

    // A route refresh hands down a freshly deserialized survey with the same content.
    rerender({ survey: makeSurvey() });

    expect(result.current.selectedFilter).toBe(selectedFilter);
    expect(result.current.dateRange).toBe(dateRange);
  });

  test("a Summary click replaces the rules that question already had", async () => {
    setUrl("filter%5Bquestion.plan%5D%5BincludesOneOf%5D=Free&filter%5Bstatus%5D%5Bin%5D=partial");
    const { result } = render();
    await waitFor(() => expect(result.current.isFilterDataLoading).toBe(false));

    act(() =>
      result.current.applyQuestionFilter({
        elementType: {
          id: "plan",
          label: "Plan",
          type: OptionsType.ELEMENTS,
          elementType: TSurveyElementTypeEnum.MultipleChoiceSingle,
        },
        filterType: { filterValue: "Includes either", filterComboBoxValue: ["Pro"] },
      })
    );

    expect(liveFilters()).toEqual([
      ["filter[status][in]", "partial"],
      ["filter[question.plan][includesOneOf]", "Pro"],
    ]);
  });

  test("keeps an attribute rule from the URL while the filter data is still loading", () => {
    filterData.resolve = false;
    setUrl("filter%5Battribute.plan%5D%5Bequals%5D=Pro");
    const { result } = render();

    expect(result.current.isFilterDataLoading).toBe(true);
    act(() =>
      result.current.setFilters([
        ...result.current.filters,
        { property: "status", operator: "in", values: ["complete"] },
      ])
    );

    expect(liveFilters()).toEqual([
      ["filter[attribute.plan][equals]", "Pro"],
      ["filter[status][in]", "complete"],
    ]);
  });
});
