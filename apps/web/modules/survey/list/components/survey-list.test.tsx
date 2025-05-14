import { FORMBRICKS_SURVEYS_FILTERS_KEY_LS } from "@/lib/localStorage";
import { getSurveysAction } from "@/modules/survey/list/actions";
import { getFormattedFilters } from "@/modules/survey/list/lib/utils";
import { TSurvey } from "@/modules/survey/list/types/surveys";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TProjectConfigChannel } from "@formbricks/types/project";
import { TSurveyFilters } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { SurveyCard } from "./survey-card";
import { SurveyFilters } from "./survey-filters";
import { SurveysList, initialFilters as surveyFiltersInitialFiltersFromModule } from "./survey-list";
import { SurveyLoading } from "./survey-loading";

// Mock definitions
vi.mock("@/modules/survey/list/actions", () => ({
  getSurveysAction: vi.fn(),
}));

vi.mock("@/modules/survey/list/lib/utils", () => ({
  getFormattedFilters: vi.fn((filters) => filters), // Simple pass-through mock
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: vi.fn(({ children, onClick, loading, disabled, ...rest }) => (
    <button onClick={onClick} disabled={loading || disabled} {...rest}>
      {loading ? "Loading..." : children}
    </button>
  )),
}));

const mockUseAutoAnimateRef = vi.fn();
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: vi.fn(() => [mockUseAutoAnimateRef]),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: vi.fn(() => ({
    t: (key: string) => key,
  })),
}));

vi.mock("./survey-card", () => ({
  SurveyCard: vi.fn(
    ({ survey, deleteSurvey, duplicateSurvey, isReadOnly, locale, environmentId, surveyDomain }) => (
      <div
        data-testid={`survey-card-${survey.id}`}
        data-readonly={isReadOnly}
        data-locale={locale}
        data-env-id={environmentId}
        data-survey-domain={surveyDomain}>
        <span>{survey.name}</span>
        <button data-testid={`delete-${survey.id}`} onClick={() => deleteSurvey(survey.id)}>
          Delete
        </button>
        <button data-testid={`duplicate-${survey.id}`} onClick={() => duplicateSurvey(survey)}>
          Duplicate
        </button>
      </div>
    )
  ),
}));

vi.mock("./survey-filters", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    initialFilters: actual.initialFilters, // Preserve initialFilters export
    SurveyFilters: vi.fn(({ setSurveyFilters, surveyFilters, currentProjectChannel }) => (
      <div data-testid="survey-filters" data-channel={currentProjectChannel}>
        <button
          data-testid="update-filter-button"
          onClick={() => setSurveyFilters({ ...surveyFilters, name: "filtered name" })}>
          Mock Update Filter
        </button>
      </div>
    )),
  };
});

vi.mock("./survey-loading", () => ({
  SurveyLoading: vi.fn(() => <div data-testid="survey-loading">Loading...</div>),
}));

let mockLocalStorageStore: { [key: string]: string } = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockLocalStorageStore[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorageStore[key] = value.toString();
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorageStore[key];
  }),
  clear: vi.fn(() => {
    mockLocalStorageStore = {};
  }),
  length: 0,
  key: vi.fn(),
};

const defaultProps = {
  environmentId: "test-env-id",
  isReadOnly: false,
  surveyDomain: "test.formbricks.com",
  userId: "test-user-id",
  surveysPerPage: 3,
  currentProjectChannel: "link" as TProjectConfigChannel,
  locale: "en" as TUserLocale,
};

const surveyMock: TSurvey = {
  id: "1",
  name: "Survey 1",
  status: "inProgress",
  type: "link",
  createdAt: new Date(),
  updatedAt: new Date(),
  responseCount: 0,
  environmentId: "test-env-id",
  singleUse: null,
  creator: null,
};

describe("SurveysList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorageStore = {};
    Object.defineProperty(window, "localStorage", {
      value: mockLocalStorage,
      writable: true,
    });
    // Reset surveyFiltersInitialFiltersFromModule to its actual initial state from the module for each test
    vi.resetModules(); // This will ensure modules are re-imported with fresh state if needed
    // Re-import or re-set specific mocks if resetModules is too broad or causes issues
    vi.mock("@/modules/survey/list/actions", () => ({
      getSurveysAction: vi.fn(),
    }));

    vi.mock("@/modules/survey/list/lib/utils", () => ({
      getFormattedFilters: vi.fn((filters) => filters),
    }));
    vi.mock("@/modules/ui/components/button", () => ({
      Button: vi.fn(({ children, onClick, loading, disabled, ...rest }) => (
        <button onClick={onClick} disabled={loading || disabled} {...rest}>
          {loading ? "Loading..." : children}
        </button>
      )),
    }));
    vi.mock("@formkit/auto-animate/react", () => ({
      useAutoAnimate: vi.fn(() => [mockUseAutoAnimateRef]),
    }));
    vi.mock("@tolgee/react", () => ({
      useTranslate: vi.fn(() => ({
        t: (key: string) => key,
      })),
    }));
    vi.mock("./survey-card", () => ({
      SurveyCard: vi.fn(
        ({ survey, deleteSurvey, duplicateSurvey, isReadOnly, locale, environmentId, surveyDomain }) => (
          <div
            data-testid={`survey-card-${survey.id}`}
            data-readonly={isReadOnly}
            data-locale={locale}
            data-env-id={environmentId}
            data-survey-domain={surveyDomain}>
            <span>{survey.name}</span>
            <button data-testid={`delete-${survey.id}`} onClick={() => deleteSurvey(survey.id)}>
              Delete
            </button>
            <button data-testid={`duplicate-${survey.id}`} onClick={() => duplicateSurvey(survey)}>
              Duplicate
            </button>
          </div>
        )
      ),
    }));
    vi.mock("./survey-filters", async (importOriginal) => {
      const actual = (await importOriginal()) as Record<string, unknown>;
      return {
        initialFilters: actual.initialFilters,
        SurveyFilters: vi.fn(({ setSurveyFilters, surveyFilters, currentProjectChannel }) => (
          <div data-testid="survey-filters" data-channel={currentProjectChannel}>
            <button
              data-testid="update-filter-button"
              onClick={() => setSurveyFilters({ ...surveyFilters, name: "filtered name" })}>
              Mock Update Filter
            </button>
          </div>
        )),
      };
    });
    vi.mock("./survey-loading", () => ({
      SurveyLoading: vi.fn(() => <div data-testid="survey-loading">Loading...</div>),
    }));
  });

  afterEach(() => {
    cleanup();
  });

  test("renders SurveyLoading initially and fetches surveys using initial filters", async () => {
    vi.mocked(getSurveysAction).mockResolvedValueOnce({ data: [] });
    render(<SurveysList {...defaultProps} />);

    expect(screen.getByTestId("survey-loading")).toBeInTheDocument();
    // Check initial call, subsequent calls might happen due to state updates after async ops
    expect(SurveyLoading).toHaveBeenCalled();

    await waitFor(() => {
      expect(getSurveysAction).toHaveBeenCalledWith({
        environmentId: defaultProps.environmentId,
        limit: defaultProps.surveysPerPage,
        filterCriteria: surveyFiltersInitialFiltersFromModule,
      });
    });
    await waitFor(() => {
      expect(screen.queryByTestId("survey-loading")).not.toBeInTheDocument();
    });
  });

  test("loads filters from localStorage if valid and fetches surveys", async () => {
    const storedFilters: TSurveyFilters = { ...surveyFiltersInitialFiltersFromModule, name: "Stored Filter" };
    mockLocalStorageStore[FORMBRICKS_SURVEYS_FILTERS_KEY_LS] = JSON.stringify(storedFilters);
    vi.mocked(getSurveysAction).mockResolvedValueOnce({ data: [] });

    render(<SurveysList {...defaultProps} />);

    await waitFor(() => {
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(FORMBRICKS_SURVEYS_FILTERS_KEY_LS);
      expect(getFormattedFilters).toHaveBeenCalledWith(storedFilters, defaultProps.userId);
      expect(getSurveysAction).toHaveBeenCalledWith(
        expect.objectContaining({
          filterCriteria: storedFilters,
        })
      );
    });
  });

  test("uses initialFilters if localStorage has invalid JSON", async () => {
    mockLocalStorageStore[FORMBRICKS_SURVEYS_FILTERS_KEY_LS] = "invalid json";
    vi.mocked(getSurveysAction).mockResolvedValueOnce({ data: [] });

    render(<SurveysList {...defaultProps} />);

    await waitFor(() => {
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(FORMBRICKS_SURVEYS_FILTERS_KEY_LS);
      expect(getFormattedFilters).toHaveBeenCalledWith(
        surveyFiltersInitialFiltersFromModule,
        defaultProps.userId
      );
      expect(getSurveysAction).toHaveBeenCalledWith(
        expect.objectContaining({
          filterCriteria: surveyFiltersInitialFiltersFromModule,
        })
      );
    });
  });

  test("fetches and displays surveys, sets hasMore to true if equal to limit, shows load more", async () => {
    const surveysData = [
      { ...surveyMock, id: "s1", name: "Survey One" },
      { ...surveyMock, id: "s2", name: "Survey Two" },
      { ...surveyMock, id: "s3", name: "Survey Three" },
    ];
    vi.mocked(getSurveysAction).mockResolvedValueOnce({ data: surveysData });

    render(<SurveysList {...defaultProps} surveysPerPage={3} />);

    await waitFor(() => {
      expect(screen.getByText("Survey One")).toBeInTheDocument();
      expect(screen.getByText("Survey Three")).toBeInTheDocument();
      expect(SurveyCard).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByText("common.load_more")).toBeInTheDocument();
  });

  test("displays 'No surveys found' message when no surveys are fetched", async () => {
    vi.mocked(getSurveysAction).mockResolvedValueOnce({ data: [] });
    render(<SurveysList {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("common.no_surveys_found")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("survey-loading")).not.toBeInTheDocument();
  });

  test("hides 'Load more' button when no more surveys to fetch on pagination", async () => {
    const initialSurveys = [{ ...surveyMock, id: "s1", name: "S1" }];
    vi.mocked(getSurveysAction)
      .mockResolvedValueOnce({ data: initialSurveys })
      .mockResolvedValueOnce({ data: [] }); // No more surveys

    const user = userEvent.setup();
    render(<SurveysList {...defaultProps} surveysPerPage={1} />);

    await waitFor(() => expect(screen.getByText("S1")).toBeInTheDocument());
    const loadMoreButton = screen.getByText("common.load_more");
    await user.click(loadMoreButton);

    await waitFor(() => {
      expect(screen.queryByText("common.load_more")).not.toBeInTheDocument();
    });
  });

  test("handleDeleteSurvey removes the survey from the list", async () => {
    const surveysData = [
      { ...surveyMock, id: "s1", name: "Survey One" },
      { ...surveyMock, id: "s2", name: "Survey Two" },
    ];
    vi.mocked(getSurveysAction).mockResolvedValueOnce({ data: surveysData });
    const user = userEvent.setup();
    render(<SurveysList {...defaultProps} />);

    await waitFor(() => expect(screen.getByText("Survey One")).toBeInTheDocument());
    expect(screen.getByText("Survey Two")).toBeInTheDocument();

    const deleteButtonS1 = screen.getByTestId("delete-s1");
    await user.click(deleteButtonS1);

    await waitFor(() => {
      expect(screen.queryByText("Survey One")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Survey Two")).toBeInTheDocument();
  });

  test("handleDuplicateSurvey adds the duplicated survey to the beginning of the list", async () => {
    const initialSurvey = { ...surveyMock, id: "s1", name: "Original Survey" };
    vi.mocked(getSurveysAction).mockResolvedValueOnce({ data: [initialSurvey] });
    const user = userEvent.setup();
    render(<SurveysList {...defaultProps} />);

    await waitFor(() => expect(screen.getByText("Original Survey")).toBeInTheDocument());

    const duplicateButtonS1 = screen.getByTestId("duplicate-s1");
    // The mock SurveyCard calls duplicateSurvey(survey) with the original survey object.
    await user.click(duplicateButtonS1);

    await waitFor(() => {
      const surveyCards = screen.getAllByTestId(/survey-card-/);
      expect(surveyCards).toHaveLength(2);
      // Both cards will show "Original Survey" as the object is prepended.
      expect(surveyCards[0]).toHaveTextContent("Original Survey");
      expect(surveyCards[1]).toHaveTextContent("Original Survey");
    });
  });

  test("applies useAutoAnimate ref to the survey list container", async () => {
    const surveysData = [{ ...surveyMock, id: "s1" }];
    vi.mocked(getSurveysAction).mockResolvedValueOnce({ data: surveysData });
    render(<SurveysList {...defaultProps} />);

    await waitFor(() => expect(screen.getByTestId(`survey-card-${surveysData[0].id}`)).toBeInTheDocument());
    expect(useAutoAnimate).toHaveBeenCalled();
    expect(mockUseAutoAnimateRef).toHaveBeenCalled();
  });

  test("handles getSurveysAction returning { data: null } by remaining in loading state", async () => {
    vi.mocked(getSurveysAction).mockResolvedValueOnce({ data: null } as any);
    render(<SurveysList {...defaultProps} />);

    expect(screen.getByTestId("survey-loading")).toBeInTheDocument(); // Initial loading

    await waitFor(() => {
      expect(getSurveysAction).toHaveBeenCalled();
    });
    // isFetching remains true because setIsFetching(false) is in `if (res?.data)`
    expect(screen.getByTestId("survey-loading")).toBeInTheDocument();
    expect(screen.queryByText("common.no_surveys_found")).not.toBeInTheDocument();
  });
});
