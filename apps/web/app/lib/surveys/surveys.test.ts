import {
  DateRange,
  SelectedFilterValue,
} from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { OptionsType } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/QuestionsComboBox";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { TLanguage } from "@formbricks/types/project";
import {
  TSurvey,
  TSurveyLanguage,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { generateQuestionAndFilterOptions, getFormattedFilters, getTodayDate } from "./surveys";

describe("surveys", () => {
  afterEach(() => {
    cleanup();
  });

  describe("generateQuestionAndFilterOptions", () => {
    test("should return question options for basic survey without additional options", () => {
      const survey = {
        id: "survey1",
        name: "Test Survey",
        questions: [
          {
            id: "q1",
            type: TSurveyQuestionTypeEnum.OpenText,
            headline: { default: "Open Text Question" },
          } as unknown as TSurveyQuestion,
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env1",
        status: "draft",
      } as unknown as TSurvey;

      const result = generateQuestionAndFilterOptions(survey, undefined, {}, {}, {});

      expect(result.questionOptions.length).toBeGreaterThan(0);
      expect(result.questionOptions[0].header).toBe(OptionsType.QUESTIONS);
      expect(result.questionFilterOptions.length).toBe(1);
      expect(result.questionFilterOptions[0].id).toBe("q1");
    });

    test("should include tags in options when provided", () => {
      const survey = {
        id: "survey1",
        name: "Test Survey",
        questions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env1",
        status: "draft",
      } as unknown as TSurvey;

      const tags: TTag[] = [
        { id: "tag1", name: "Tag 1", environmentId: "env1", createdAt: new Date(), updatedAt: new Date() },
      ];

      const result = generateQuestionAndFilterOptions(survey, tags, {}, {}, {});

      const tagsHeader = result.questionOptions.find((opt) => opt.header === OptionsType.TAGS);
      expect(tagsHeader).toBeDefined();
      expect(tagsHeader?.option.length).toBe(1);
      expect(tagsHeader?.option[0].label).toBe("Tag 1");
    });

    test("should include attributes in options when provided", () => {
      const survey = {
        id: "survey1",
        name: "Test Survey",
        questions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env1",
        status: "draft",
      } as unknown as TSurvey;

      const attributes = {
        role: ["admin", "user"],
      };

      const result = generateQuestionAndFilterOptions(survey, undefined, attributes, {}, {});

      const attributesHeader = result.questionOptions.find((opt) => opt.header === OptionsType.ATTRIBUTES);
      expect(attributesHeader).toBeDefined();
      expect(attributesHeader?.option.length).toBe(1);
      expect(attributesHeader?.option[0].label).toBe("role");
    });

    test("should include meta in options when provided", () => {
      const survey = {
        id: "survey1",
        name: "Test Survey",
        questions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env1",
        status: "draft",
      } as unknown as TSurvey;

      const meta = {
        source: ["web", "mobile"],
      };

      const result = generateQuestionAndFilterOptions(survey, undefined, {}, meta, {});

      const metaHeader = result.questionOptions.find((opt) => opt.header === OptionsType.META);
      expect(metaHeader).toBeDefined();
      expect(metaHeader?.option.length).toBe(1);
      expect(metaHeader?.option[0].label).toBe("source");
    });

    test("should include hidden fields in options when provided", () => {
      const survey = {
        id: "survey1",
        name: "Test Survey",
        questions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env1",
        status: "draft",
      } as unknown as TSurvey;

      const hiddenFields = {
        segment: ["free", "paid"],
      };

      const result = generateQuestionAndFilterOptions(survey, undefined, {}, {}, hiddenFields);

      const hiddenFieldsHeader = result.questionOptions.find(
        (opt) => opt.header === OptionsType.HIDDEN_FIELDS
      );
      expect(hiddenFieldsHeader).toBeDefined();
      expect(hiddenFieldsHeader?.option.length).toBe(1);
      expect(hiddenFieldsHeader?.option[0].label).toBe("segment");
    });

    test("should include language options when survey has languages", () => {
      const survey = {
        id: "survey1",
        name: "Test Survey",
        questions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env1",
        status: "draft",
        languages: [{ language: { code: "en" } as unknown as TLanguage } as unknown as TSurveyLanguage],
      } as unknown as TSurvey;

      const result = generateQuestionAndFilterOptions(survey, undefined, {}, {}, {});

      const othersHeader = result.questionOptions.find((opt) => opt.header === OptionsType.OTHERS);
      expect(othersHeader).toBeDefined();
      expect(othersHeader?.option.some((o) => o.label === "Language")).toBeTruthy();
    });

    test("should handle all question types correctly", () => {
      const survey = {
        id: "survey1",
        name: "Test Survey",
        questions: [
          {
            id: "q1",
            type: TSurveyQuestionTypeEnum.OpenText,
            headline: { default: "Open Text" },
          } as unknown as TSurveyQuestion,
          {
            id: "q2",
            type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
            headline: { default: "Multiple Choice Single" },
            choices: [{ id: "c1", label: "Choice 1" }],
          } as unknown as TSurveyQuestion,
          {
            id: "q3",
            type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
            headline: { default: "Multiple Choice Multi" },
            choices: [
              { id: "c1", label: "Choice 1" },
              { id: "other", label: "Other" },
            ],
          } as unknown as TSurveyQuestion,
          {
            id: "q4",
            type: TSurveyQuestionTypeEnum.NPS,
            headline: { default: "NPS" },
          } as unknown as TSurveyQuestion,
          {
            id: "q5",
            type: TSurveyQuestionTypeEnum.Rating,
            headline: { default: "Rating" },
          } as unknown as TSurveyQuestion,
          {
            id: "q6",
            type: TSurveyQuestionTypeEnum.CTA,
            headline: { default: "CTA" },
          } as unknown as TSurveyQuestion,
          {
            id: "q7",
            type: TSurveyQuestionTypeEnum.PictureSelection,
            headline: { default: "Picture Selection" },
            choices: [
              { id: "p1", imageUrl: "url1" },
              { id: "p2", imageUrl: "url2" },
            ],
          } as unknown as TSurveyQuestion,
          {
            id: "q8",
            type: TSurveyQuestionTypeEnum.Matrix,
            headline: { default: "Matrix" },
            rows: [{ id: "r1", label: "Row 1" }],
            columns: [{ id: "c1", label: "Column 1" }],
          } as unknown as TSurveyQuestion,
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env1",
        status: "draft",
      } as unknown as TSurvey;

      const result = generateQuestionAndFilterOptions(survey, undefined, {}, {}, {});

      expect(result.questionFilterOptions.length).toBe(8);
      expect(result.questionFilterOptions.some((o) => o.id === "q1")).toBeTruthy();
      expect(result.questionFilterOptions.some((o) => o.id === "q2")).toBeTruthy();
      expect(result.questionFilterOptions.some((o) => o.id === "q7")).toBeTruthy();
      expect(result.questionFilterOptions.some((o) => o.id === "q8")).toBeTruthy();
    });
  });

  describe("getFormattedFilters", () => {
    const survey = {
      id: "survey1",
      name: "Test Survey",
      questions: [
        {
          id: "openTextQ",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Open Text" },
        } as unknown as TSurveyQuestion,
        {
          id: "mcSingleQ",
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "Multiple Choice Single" },
          choices: [{ id: "c1", label: "Choice 1" }],
        } as unknown as TSurveyQuestion,
        {
          id: "mcMultiQ",
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: { default: "Multiple Choice Multi" },
          choices: [{ id: "c1", label: "Choice 1" }],
        } as unknown as TSurveyQuestion,
        {
          id: "npsQ",
          type: TSurveyQuestionTypeEnum.NPS,
          headline: { default: "NPS" },
        } as unknown as TSurveyQuestion,
        {
          id: "ratingQ",
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: "Rating" },
        } as unknown as TSurveyQuestion,
        {
          id: "ctaQ",
          type: TSurveyQuestionTypeEnum.CTA,
          headline: { default: "CTA" },
        } as unknown as TSurveyQuestion,
        {
          id: "consentQ",
          type: TSurveyQuestionTypeEnum.Consent,
          headline: { default: "Consent" },
        } as unknown as TSurveyQuestion,
        {
          id: "pictureQ",
          type: TSurveyQuestionTypeEnum.PictureSelection,
          headline: { default: "Picture Selection" },
          choices: [
            { id: "p1", imageUrl: "url1" },
            { id: "p2", imageUrl: "url2" },
          ],
        } as unknown as TSurveyQuestion,
        {
          id: "matrixQ",
          type: TSurveyQuestionTypeEnum.Matrix,
          headline: { default: "Matrix" },
          rows: [{ id: "r1", label: "Row 1" }],
          columns: [{ id: "c1", label: "Column 1" }],
        } as unknown as TSurveyQuestion,
        {
          id: "addressQ",
          type: TSurveyQuestionTypeEnum.Address,
          headline: { default: "Address" },
        } as unknown as TSurveyQuestion,
        {
          id: "contactQ",
          type: TSurveyQuestionTypeEnum.ContactInfo,
          headline: { default: "Contact Info" },
        } as unknown as TSurveyQuestion,
        {
          id: "rankingQ",
          type: TSurveyQuestionTypeEnum.Ranking,
          headline: { default: "Ranking" },
        } as unknown as TSurveyQuestion,
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "env1",
      status: "draft",
    } as unknown as TSurvey;

    const dateRange: DateRange = {
      from: new Date("2023-01-01"),
      to: new Date("2023-01-31"),
    };

    test("should return empty filters when no selections", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [],
      };

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(Object.keys(result).length).toBe(0);
    });

    test("should filter by completed responses", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: true,
        filter: [],
      };

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.finished).toBe(true);
    });

    test("should filter by date range", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [],
      };

      const result = getFormattedFilters(survey, selectedFilter, dateRange);

      expect(result.createdAt).toBeDefined();
      expect(result.createdAt?.min).toEqual(dateRange.from);
      expect(result.createdAt?.max).toEqual(dateRange.to);
    });

    test("should filter by tags", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [
          {
            questionType: { type: "Tags", label: "Tag 1", id: "tag1" },
            filterType: { filterComboBoxValue: "Applied" },
          },
          {
            questionType: { type: "Tags", label: "Tag 2", id: "tag2" },
            filterType: { filterComboBoxValue: "Not applied" },
          },
        ] as any,
      };

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.tags?.applied).toContain("Tag 1");
      expect(result.tags?.notApplied).toContain("Tag 2");
    });

    test("should filter by open text questions", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [
          {
            questionType: {
              type: "Questions",
              label: "Open Text",
              id: "openTextQ",
              questionType: TSurveyQuestionTypeEnum.OpenText,
            },
            filterType: { filterComboBoxValue: "Filled out" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.data?.openTextQ).toEqual({ op: "filledOut" });
    });

    test("should filter by address questions", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [
          {
            questionType: {
              type: "Questions",
              label: "Address",
              id: "addressQ",
              questionType: TSurveyQuestionTypeEnum.Address,
            },
            filterType: { filterComboBoxValue: "Skipped" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.data?.addressQ).toEqual({ op: "skipped" });
    });

    test("should filter by contact info questions", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [
          {
            questionType: {
              type: "Questions",
              label: "Contact Info",
              id: "contactQ",
              questionType: TSurveyQuestionTypeEnum.ContactInfo,
            },
            filterType: { filterComboBoxValue: "Filled out" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.data?.contactQ).toEqual({ op: "filledOut" });
    });

    test("should filter by ranking questions", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [
          {
            questionType: {
              type: "Questions",
              label: "Ranking",
              id: "rankingQ",
              questionType: TSurveyQuestionTypeEnum.Ranking,
            },
            filterType: { filterComboBoxValue: "Filled out" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.data?.rankingQ).toEqual({ op: "submitted" });
    });

    test("should filter by multiple choice single questions", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [
          {
            questionType: {
              type: "Questions",
              label: "MC Single",
              id: "mcSingleQ",
              questionType: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
            },
            filterType: { filterValue: "Includes either", filterComboBoxValue: ["Choice 1"] },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.data?.mcSingleQ).toEqual({ op: "includesOne", value: ["Choice 1"] });
    });

    test("should filter by multiple choice multi questions", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [
          {
            questionType: {
              type: "Questions",
              label: "MC Multi",
              id: "mcMultiQ",
              questionType: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
            },
            filterType: { filterValue: "Includes all", filterComboBoxValue: ["Choice 1", "Choice 2"] },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.data?.mcMultiQ).toEqual({ op: "includesAll", value: ["Choice 1", "Choice 2"] });
    });

    test("should filter by NPS questions with different operations", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [
          {
            questionType: {
              type: "Questions",
              label: "NPS",
              id: "npsQ",
              questionType: TSurveyQuestionTypeEnum.NPS,
            },
            filterType: { filterValue: "Is equal to", filterComboBoxValue: "7" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.data?.npsQ).toEqual({ op: "equals", value: 7 });
    });

    test("should filter by rating questions with less than operation", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [
          {
            questionType: {
              type: "Questions",
              label: "Rating",
              id: "ratingQ",
              questionType: TSurveyQuestionTypeEnum.Rating,
            },
            filterType: { filterValue: "Is less than", filterComboBoxValue: "4" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.data?.ratingQ).toEqual({ op: "lessThan", value: 4 });
    });

    test("should filter by CTA questions", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [
          {
            questionType: {
              type: "Questions",
              label: "CTA",
              id: "ctaQ",
              questionType: TSurveyQuestionTypeEnum.CTA,
            },
            filterType: { filterComboBoxValue: "Clicked" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.data?.ctaQ).toEqual({ op: "clicked" });
    });

    test("should filter by consent questions", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [
          {
            questionType: {
              type: "Questions",
              label: "Consent",
              id: "consentQ",
              questionType: TSurveyQuestionTypeEnum.Consent,
            },
            filterType: { filterComboBoxValue: "Accepted" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.data?.consentQ).toEqual({ op: "accepted" });
    });

    test("should filter by picture selection questions", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [
          {
            questionType: {
              type: "Questions",
              label: "Picture",
              id: "pictureQ",
              questionType: TSurveyQuestionTypeEnum.PictureSelection,
            },
            filterType: { filterValue: "Includes either", filterComboBoxValue: ["Picture 1"] },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.data?.pictureQ).toEqual({ op: "includesOne", value: ["p1"] });
    });

    test("should filter by matrix questions", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [
          {
            questionType: {
              type: "Questions",
              label: "Matrix",
              id: "matrixQ",
              questionType: TSurveyQuestionTypeEnum.Matrix,
            },
            filterType: { filterValue: "Row 1", filterComboBoxValue: "Column 1" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.data?.matrixQ).toEqual({ op: "matrix", value: { "Row 1": "Column 1" } });
    });

    test("should filter by hidden fields", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [
          {
            questionType: { type: "Hidden Fields", label: "plan", id: "plan" },
            filterType: { filterValue: "Equals", filterComboBoxValue: "pro" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.data?.plan).toEqual({ op: "equals", value: "pro" });
    });

    test("should filter by attributes", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [
          {
            questionType: { type: "Attributes", label: "role", id: "role" },
            filterType: { filterValue: "Not equals", filterComboBoxValue: "admin" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.contactAttributes?.role).toEqual({ op: "notEquals", value: "admin" });
    });

    test("should filter by other filters", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [
          {
            questionType: { type: "Other Filters", label: "Language", id: "language" },
            filterType: { filterValue: "Equals", filterComboBoxValue: "en" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.others?.Language).toEqual({ op: "equals", value: "en" });
    });

    test("should filter by meta fields", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: false,
        filter: [
          {
            questionType: { type: "Meta", label: "source", id: "source" },
            filterType: { filterValue: "Not equals", filterComboBoxValue: "web" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.meta?.source).toEqual({ op: "notEquals", value: "web" });
    });

    test("should handle multiple filters together", () => {
      const selectedFilter: SelectedFilterValue = {
        onlyComplete: true,
        filter: [
          {
            questionType: {
              type: "Questions",
              label: "NPS",
              id: "npsQ",
              questionType: TSurveyQuestionTypeEnum.NPS,
            },
            filterType: { filterValue: "Is more than", filterComboBoxValue: "7" },
          },
          {
            questionType: { type: "Tags", label: "Tag 1", id: "tag1" },
            filterType: { filterComboBoxValue: "Applied" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, dateRange);

      expect(result.finished).toBe(true);
      expect(result.createdAt).toBeDefined();
      expect(result.data?.npsQ).toEqual({ op: "greaterThan", value: 7 });
      expect(result.tags?.applied).toContain("Tag 1");
    });
  });

  describe("getTodayDate", () => {
    test("should return today's date with time set to end of day", () => {
      const today = new Date();
      const result = getTodayDate();

      expect(result.getFullYear()).toBe(today.getFullYear());
      expect(result.getMonth()).toBe(today.getMonth());
      expect(result.getDate()).toBe(today.getDate());
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });
  });
});
