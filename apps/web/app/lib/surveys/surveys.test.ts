import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { TLanguage } from "@formbricks/types/project";
import { type TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyLanguage } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import {
  DateRange,
  SelectedFilterValue,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/response-filter-context";
import { OptionsType } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/ElementsComboBox";
import { generateElementAndFilterOptions, getFormattedFilters, getTodayDate } from "./surveys";

describe("surveys", () => {
  afterEach(() => {
    cleanup();
  });

  describe("generateQuestionAndFilterOptions", () => {
    test("should return question options for basic survey without additional options", () => {
      const survey = {
        id: "survey1",
        name: "Test Survey",
        blocks: [
          {
            id: "block1",
            name: "Block 1",
            elements: [
              {
                id: "q1",
                type: TSurveyElementTypeEnum.OpenText,
                headline: { default: "Open Text Question" },
                required: false,
                inputType: "text",
                charLimit: { enabled: false },
              } as TSurveyElement,
            ],
          },
        ],
        questions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env1",
        status: "draft",
      } as unknown as TSurvey;

      const result = generateElementAndFilterOptions(survey, undefined, {}, {}, {}, []);

      expect(result.elementOptions.length).toBeGreaterThan(0);
      expect(result.elementOptions[0].header).toBe(OptionsType.ELEMENTS);
      expect(result.elementFilterOptions.length).toBe(1);
      expect(result.elementFilterOptions[0].id).toBe("q1");
    });

    test("should include tags in options when provided", () => {
      const survey = {
        id: "survey1",
        name: "Test Survey",
        blocks: [],
        questions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env1",
        status: "draft",
      } as unknown as TSurvey;

      const tags: TTag[] = [
        { id: "tag1", name: "Tag 1", environmentId: "env1", createdAt: new Date(), updatedAt: new Date() },
      ];

      const result = generateElementAndFilterOptions(survey, tags, {}, {}, {}, []);

      const tagsHeader = result.elementOptions.find((opt) => opt.header === OptionsType.TAGS);
      expect(tagsHeader).toBeDefined();
      expect(tagsHeader?.option.length).toBe(1);
      expect(tagsHeader?.option[0].label).toBe("Tag 1");
    });

    test("should include attributes in options when provided", () => {
      const survey = {
        id: "survey1",
        name: "Test Survey",
        blocks: [],
        questions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env1",
        status: "draft",
      } as unknown as TSurvey;

      const attributes = {
        role: ["admin", "user"],
      };

      const result = generateElementAndFilterOptions(survey, undefined, attributes, {}, {}, []);

      const attributesHeader = result.elementOptions.find((opt) => opt.header === OptionsType.ATTRIBUTES);
      expect(attributesHeader).toBeDefined();
      expect(attributesHeader?.option.length).toBe(1);
      expect(attributesHeader?.option[0].label).toBe("role");
    });

    test("should include meta in options when provided", () => {
      const survey = {
        id: "survey1",
        name: "Test Survey",
        blocks: [],
        questions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env1",
        status: "draft",
      } as unknown as TSurvey;

      const meta = {
        source: ["web", "mobile"],
      };

      const result = generateElementAndFilterOptions(survey, undefined, {}, meta, {}, []);

      const metaHeader = result.elementOptions.find((opt) => opt.header === OptionsType.META);
      expect(metaHeader).toBeDefined();
      expect(metaHeader?.option.length).toBe(1);
      expect(metaHeader?.option[0].label).toBe("source");
    });

    test("should include hidden fields in options when provided", () => {
      const survey = {
        id: "survey1",
        name: "Test Survey",
        blocks: [],
        questions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env1",
        status: "draft",
      } as unknown as TSurvey;

      const hiddenFields = {
        segment: ["free", "paid"],
      };

      const result = generateElementAndFilterOptions(survey, undefined, {}, {}, hiddenFields, []);

      const hiddenFieldsHeader = result.elementOptions.find(
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
        blocks: [],
        questions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env1",
        status: "draft",
        languages: [{ language: { code: "en" } as unknown as TLanguage } as unknown as TSurveyLanguage],
      } as unknown as TSurvey;

      const result = generateElementAndFilterOptions(survey, undefined, {}, {}, {}, []);

      const othersHeader = result.elementOptions.find((opt) => opt.header === OptionsType.OTHERS);
      expect(othersHeader).toBeDefined();
      expect(othersHeader?.option.some((o) => o.label === "Language")).toBeTruthy();
    });

    test("should handle all question types correctly", () => {
      const survey = {
        id: "survey1",
        name: "Test Survey",
        blocks: [
          {
            id: "block1",
            name: "Block 1",
            elements: [
              {
                id: "q1",
                type: TSurveyElementTypeEnum.OpenText,
                headline: { default: "Open Text" },
                required: false,
                inputType: "text",
                charLimit: { enabled: false },
              },
              {
                id: "q2",
                type: TSurveyElementTypeEnum.MultipleChoiceSingle,
                headline: { default: "Multiple Choice Single" },
                required: false,
                choices: [{ id: "c1", label: { default: "Choice 1" } }],
                shuffleOption: "none",
              },
              {
                id: "q3",
                type: TSurveyElementTypeEnum.MultipleChoiceMulti,
                headline: { default: "Multiple Choice Multi" },
                required: false,
                choices: [
                  { id: "c1", label: { default: "Choice 1" } },
                  { id: "other", label: { default: "Other" } },
                ],
                shuffleOption: "none",
              },
              {
                id: "q4",
                type: TSurveyElementTypeEnum.NPS,
                headline: { default: "NPS" },
                required: false,
                lowerLabel: { default: "Not likely" },
                upperLabel: { default: "Very likely" },
              },
              {
                id: "q5",
                type: TSurveyElementTypeEnum.Rating,
                headline: { default: "Rating" },
                required: false,
                scale: "number",
                range: 5,
                lowerLabel: { default: "Low" },
                upperLabel: { default: "High" },
              },
              {
                id: "q6",
                type: TSurveyElementTypeEnum.CTA,
                headline: { default: "CTA" },
                required: false,
                buttonLabel: { default: "Click me" },
                buttonExternal: false,
              },
              {
                id: "q7",
                type: TSurveyElementTypeEnum.PictureSelection,
                headline: { default: "Picture Selection" },
                required: false,
                allowMultiple: false,
                choices: [
                  { id: "p1", imageUrl: "url1" },
                  { id: "p2", imageUrl: "url2" },
                ],
              },
              {
                id: "q8",
                type: TSurveyElementTypeEnum.Matrix,
                headline: { default: "Matrix" },
                required: false,
                rows: [{ id: "r1", label: { default: "Row 1" } }],
                columns: [{ id: "c1", label: { default: "Column 1" } }],
              },
            ] as TSurveyElement[],
          },
        ],
        questions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env1",
        status: "draft",
      } as unknown as TSurvey;

      const result = generateElementAndFilterOptions(survey, undefined, {}, {}, {}, []);

      expect(result.elementFilterOptions.length).toBe(8);
      expect(result.elementFilterOptions.some((o) => o.id === "q1")).toBeTruthy();
      expect(result.elementFilterOptions.some((o) => o.id === "q2")).toBeTruthy();
      expect(result.elementFilterOptions.some((o) => o.id === "q7")).toBeTruthy();
      expect(result.elementFilterOptions.some((o) => o.id === "q8")).toBeTruthy();
    });

    test("should provide extended filter options for URL meta field", () => {
      const survey = {
        id: "survey1",
        name: "Test Survey",
        blocks: [],
        questions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env1",
        status: "draft",
      } as unknown as TSurvey;

      const meta = {
        url: ["https://example.com", "https://test.com"],
        source: ["web", "mobile"],
      };

      const result = generateElementAndFilterOptions(survey, undefined, {}, meta, {}, []);

      const urlFilterOption = result.elementFilterOptions.find((o) => o.id === "url");
      const sourceFilterOption = result.elementFilterOptions.find((o) => o.id === "source");

      expect(urlFilterOption).toBeDefined();
      expect(urlFilterOption?.filterOptions).toEqual([
        "Equals",
        "Not equals",
        "Contains",
        "Does not contain",
        "Starts with",
        "Does not start with",
        "Ends with",
        "Does not end with",
      ]);

      expect(sourceFilterOption).toBeDefined();
      expect(sourceFilterOption?.filterOptions).toEqual(["Equals", "Not equals"]);
    });

    test("should include quota options in filter options when quotas are provided", () => {
      const survey = {
        id: "survey1",
        name: "Test Survey",
        blocks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env1",
        status: "draft",
      } as unknown as TSurvey;

      const quotas = [{ id: "quota1" }];

      const result = generateElementAndFilterOptions(survey, undefined, {}, {}, {}, quotas as any);

      const quotaFilterOption = result.elementFilterOptions.find((o) => o.id === "quota1");
      expect(quotaFilterOption).toBeDefined();
      expect(quotaFilterOption?.type).toBe("Quotas");
      expect(quotaFilterOption?.filterOptions).toEqual(["Status"]);
      expect(quotaFilterOption?.filterComboBoxOptions).toEqual([
        "Screened in",
        "Screened out (overquota)",
        "Not in quota",
      ]);
    });

    test("should include multiple quota options when multiple quotas are provided", () => {
      const survey = {
        id: "survey1",
        name: "Test Survey",
        blocks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        environmentId: "env1",
        status: "draft",
      } as unknown as TSurvey;

      const quotas = [{ id: "quota1" }, { id: "quota2" }];

      const result = generateElementAndFilterOptions(survey, undefined, {}, {}, {}, quotas as any);

      const quota1 = result.elementFilterOptions.find((o) => o.id === "quota1");
      const quota2 = result.elementFilterOptions.find((o) => o.id === "quota2");

      expect(quota1).toBeDefined();
      expect(quota2).toBeDefined();
      expect(quota1?.filterComboBoxOptions).toEqual([
        "Screened in",
        "Screened out (overquota)",
        "Not in quota",
      ]);
      expect(quota2?.filterComboBoxOptions).toEqual([
        "Screened in",
        "Screened out (overquota)",
        "Not in quota",
      ]);
    });
  });

  describe("getFormattedFilters", () => {
    const survey = {
      id: "survey1",
      name: "Test Survey",
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "openTextQ",
              type: TSurveyElementTypeEnum.OpenText,
              headline: { default: "Open Text" },
              required: false,
              inputType: "text",
              charLimit: { enabled: false },
            },
            {
              id: "mcSingleQ",
              type: TSurveyElementTypeEnum.MultipleChoiceSingle,
              headline: { default: "Multiple Choice Single" },
              required: false,
              choices: [{ id: "c1", label: { default: "Choice 1" } }],
              shuffleOption: "none",
            },
            {
              id: "mcMultiQ",
              type: TSurveyElementTypeEnum.MultipleChoiceMulti,
              headline: { default: "Multiple Choice Multi" },
              required: false,
              choices: [{ id: "c1", label: { default: "Choice 1" } }],
              shuffleOption: "none",
            },
            {
              id: "npsQ",
              type: TSurveyElementTypeEnum.NPS,
              headline: { default: "NPS" },
              required: false,
              lowerLabel: { default: "Not likely" },
              upperLabel: { default: "Very likely" },
            },
            {
              id: "ratingQ",
              type: TSurveyElementTypeEnum.Rating,
              headline: { default: "Rating" },
              required: false,
              scale: "number",
              range: 5,
              lowerLabel: { default: "Low" },
              upperLabel: { default: "High" },
            },
            {
              id: "ctaQ",
              type: TSurveyElementTypeEnum.CTA,
              headline: { default: "CTA" },
              required: false,
              buttonLabel: { default: "Click me" },
              buttonExternal: false,
            },
            {
              id: "consentQ",
              type: TSurveyElementTypeEnum.Consent,
              headline: { default: "Consent" },
              required: false,
              label: { default: "I agree" },
            },
            {
              id: "pictureQ",
              type: TSurveyElementTypeEnum.PictureSelection,
              headline: { default: "Picture Selection" },
              required: false,
              allowMultiple: false,
              choices: [
                { id: "p1", imageUrl: "url1" },
                { id: "p2", imageUrl: "url2" },
              ],
            },
            {
              id: "matrixQ",
              type: TSurveyElementTypeEnum.Matrix,
              headline: { default: "Matrix" },
              required: false,
              rows: [{ id: "r1", label: { default: "Row 1" } }],
              columns: [{ id: "c1", label: { default: "Column 1" } }],
            },
            {
              id: "addressQ",
              type: TSurveyElementTypeEnum.Address,
              headline: { default: "Address" },
              required: false,
              zip: { show: true, required: false, placeholder: { default: "Zip" } },
              city: { show: true, required: false, placeholder: { default: "City" } },
              state: { show: true, required: false, placeholder: { default: "State" } },
              country: { show: true, required: false, placeholder: { default: "Country" } },
              addressLine1: { show: true, required: false, placeholder: { default: "Address Line 1" } },
              addressLine2: { show: true, required: false, placeholder: { default: "Address Line 2" } },
            },
            {
              id: "contactQ",
              type: TSurveyElementTypeEnum.ContactInfo,
              headline: { default: "Contact Info" },
              required: false,
              firstName: { show: true, required: false, placeholder: { default: "First Name" } },
              lastName: { show: true, required: false, placeholder: { default: "Last Name" } },
              email: { show: true, required: false, placeholder: { default: "Email" } },
              phone: { show: true, required: false, placeholder: { default: "Phone" } },
              company: { show: true, required: false, placeholder: { default: "Company" } },
            },
            {
              id: "rankingQ",
              type: TSurveyElementTypeEnum.Ranking,
              headline: { default: "Ranking" },
              required: false,
              choices: [{ id: "r1", label: { default: "Option 1" } }],
            },
          ] as TSurveyElement[],
        },
      ],
      questions: [],
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
        responseStatus: "all",
        filter: [],
      };

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(Object.keys(result).length).toBe(0);
    });

    test("should filter by completed responses", () => {
      const selectedFilter: SelectedFilterValue = {
        responseStatus: "complete",
        filter: [],
      };

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.finished).toBe(true);
    });

    test("should filter by date range", () => {
      const selectedFilter: SelectedFilterValue = {
        responseStatus: "all",
        filter: [],
      };

      const result = getFormattedFilters(survey, selectedFilter, dateRange);

      expect(result.createdAt).toBeDefined();
      expect(result.createdAt?.min).toEqual(dateRange.from);
      expect(result.createdAt?.max).toEqual(dateRange.to);
    });

    test("should filter by tags", () => {
      const selectedFilter: SelectedFilterValue = {
        responseStatus: "all",
        filter: [
          {
            elementType: { type: "Tags", label: "Tag 1", id: "tag1" },
            filterType: { filterComboBoxValue: "Applied" },
          },
          {
            elementType: { type: "Tags", label: "Tag 2", id: "tag2" },
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
        responseStatus: "all",
        filter: [
          {
            elementType: {
              type: "Elements",
              label: "Open Text",
              id: "openTextQ",
              elementType: TSurveyElementTypeEnum.OpenText,
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
        responseStatus: "all",
        filter: [
          {
            elementType: {
              type: "Elements",
              label: "Address",
              id: "addressQ",
              elementType: TSurveyElementTypeEnum.Address,
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
        responseStatus: "all",
        filter: [
          {
            elementType: {
              type: "Elements",
              label: "Contact Info",
              id: "contactQ",
              elementType: TSurveyElementTypeEnum.ContactInfo,
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
        responseStatus: "all",
        filter: [
          {
            elementType: {
              type: "Elements",
              label: "Ranking",
              id: "rankingQ",
              elementType: TSurveyElementTypeEnum.Ranking,
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
        responseStatus: "all",
        filter: [
          {
            elementType: {
              type: "Elements",
              label: "MC Single",
              id: "mcSingleQ",
              elementType: TSurveyElementTypeEnum.MultipleChoiceSingle,
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
        responseStatus: "all",
        filter: [
          {
            elementType: {
              type: "Elements",
              label: "MC Multi",
              id: "mcMultiQ",
              elementType: TSurveyElementTypeEnum.MultipleChoiceMulti,
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
        responseStatus: "all",
        filter: [
          {
            elementType: {
              type: "Elements",
              label: "NPS",
              id: "npsQ",
              elementType: TSurveyElementTypeEnum.NPS,
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
        responseStatus: "all",
        filter: [
          {
            elementType: {
              type: "Elements",
              label: "Rating",
              id: "ratingQ",
              elementType: TSurveyElementTypeEnum.Rating,
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
        responseStatus: "all",
        filter: [
          {
            elementType: {
              type: "Elements",
              label: "CTA",
              id: "ctaQ",
              elementType: TSurveyElementTypeEnum.CTA,
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
        responseStatus: "all",
        filter: [
          {
            elementType: {
              type: "Elements",
              label: "Consent",
              id: "consentQ",
              elementType: TSurveyElementTypeEnum.Consent,
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
        responseStatus: "all",
        filter: [
          {
            elementType: {
              type: "Elements",
              label: "Picture",
              id: "pictureQ",
              elementType: TSurveyElementTypeEnum.PictureSelection,
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
        responseStatus: "all",
        filter: [
          {
            elementType: {
              type: "Elements",
              label: "Matrix",
              id: "matrixQ",
              elementType: TSurveyElementTypeEnum.Matrix,
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
        responseStatus: "all",
        filter: [
          {
            elementType: { type: "Hidden Fields", label: "plan", id: "plan" },
            filterType: { filterValue: "Equals", filterComboBoxValue: "pro" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.data?.plan).toEqual({ op: "equals", value: "pro" });
    });

    test("should filter by attributes", () => {
      const selectedFilter: SelectedFilterValue = {
        responseStatus: "all",
        filter: [
          {
            elementType: { type: "Attributes", label: "role", id: "role" },
            filterType: { filterValue: "Not equals", filterComboBoxValue: "admin" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.contactAttributes?.role).toEqual({ op: "notEquals", value: "admin" });
    });

    test("should filter by other filters", () => {
      const selectedFilter: SelectedFilterValue = {
        responseStatus: "all",
        filter: [
          {
            elementType: { type: "Other Filters", label: "Language", id: "language" },
            filterType: { filterValue: "Equals", filterComboBoxValue: "en" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.others?.Language).toEqual({ op: "equals", value: "en" });
    });

    test("should filter by meta fields", () => {
      const selectedFilter: SelectedFilterValue = {
        responseStatus: "all",
        filter: [
          {
            elementType: { type: "Meta", label: "source", id: "source" },
            filterType: { filterValue: "Not equals", filterComboBoxValue: "web" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.meta?.source).toEqual({ op: "notEquals", value: "web" });
    });

    test("should handle multiple filters together", () => {
      const selectedFilter: SelectedFilterValue = {
        responseStatus: "complete",
        filter: [
          {
            elementType: {
              type: "Elements",
              label: "NPS",
              id: "npsQ",
              elementType: TSurveyElementTypeEnum.NPS,
            },
            filterType: { filterValue: "Is more than", filterComboBoxValue: "7" },
          },
          {
            elementType: { type: "Tags", label: "Tag 1", id: "tag1" },
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

    test("should format URL meta filters with string operations", () => {
      const selectedFilter = {
        responseStatus: "all",
        filter: [
          {
            elementType: { type: "Meta", label: "url", id: "url" },
            filterType: { filterValue: "Contains", filterComboBoxValue: "example.com" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, dateRange);

      expect(result.meta?.url).toEqual({ op: "contains", value: "example.com" });
    });

    test("should format URL meta filters with all supported string operations", () => {
      const testCases = [
        { filterValue: "Equals", expected: { op: "equals", value: "https://example.com" } },
        { filterValue: "Not equals", expected: { op: "notEquals", value: "https://example.com" } },
        { filterValue: "Contains", expected: { op: "contains", value: "example.com" } },
        { filterValue: "Does not contain", expected: { op: "doesNotContain", value: "test.com" } },
        { filterValue: "Starts with", expected: { op: "startsWith", value: "https://" } },
        { filterValue: "Does not start with", expected: { op: "doesNotStartWith", value: "http://" } },
        { filterValue: "Ends with", expected: { op: "endsWith", value: ".com" } },
        { filterValue: "Does not end with", expected: { op: "doesNotEndWith", value: ".org" } },
      ];

      testCases.forEach(({ filterValue, expected }) => {
        const selectedFilter = {
          responseStatus: "all",
          filter: [
            {
              elementType: { type: "Meta", label: "url", id: "url" },
              filterType: { filterValue, filterComboBoxValue: expected.value },
            },
          ],
        } as any;

        const result = getFormattedFilters(survey, selectedFilter, dateRange);
        expect(result.meta?.url).toEqual(expected);
      });
    });

    test("should handle URL meta filters with empty string values", () => {
      const selectedFilter = {
        responseStatus: "all",
        filter: [
          {
            elementType: { type: "Meta", label: "url", id: "url" },
            filterType: { filterValue: "Contains", filterComboBoxValue: "" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, dateRange);

      expect(result.meta?.url).toBeUndefined();
    });

    test("should handle URL meta filters with whitespace-only values", () => {
      const selectedFilter = {
        responseStatus: "all",
        filter: [
          {
            elementType: { type: "Meta", label: "url", id: "url" },
            filterType: { filterValue: "Contains", filterComboBoxValue: "   " },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, dateRange);

      expect(result.meta?.url).toEqual({ op: "contains", value: "" });
    });

    test("should still handle existing meta filters with array values", () => {
      const selectedFilter = {
        responseStatus: "all",
        filter: [
          {
            elementType: { type: "Meta", label: "source", id: "source" },
            filterType: { filterValue: "Equals", filterComboBoxValue: ["google"] },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, dateRange);

      expect(result.meta?.source).toEqual({ op: "equals", value: "google" });
    });

    test("should handle mixed URL and traditional meta filters", () => {
      const selectedFilter = {
        responseStatus: "all",
        filter: [
          {
            elementType: { type: "Meta", label: "url", id: "url" },
            filterType: { filterValue: "Contains", filterComboBoxValue: "formbricks.com" },
          },
          {
            elementType: { type: "Meta", label: "source", id: "source" },
            filterType: { filterValue: "Equals", filterComboBoxValue: ["newsletter"] },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, dateRange);

      expect(result.meta?.url).toEqual({ op: "contains", value: "formbricks.com" });
      expect(result.meta?.source).toEqual({ op: "equals", value: "newsletter" });
    });

    test("should filter by quota with screened in status", () => {
      const selectedFilter: SelectedFilterValue = {
        responseStatus: "all",
        filter: [
          {
            elementType: { type: "Quotas", label: "Quota 1", id: "quota1" },
            filterType: { filterComboBoxValue: "Screened in" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.quotas?.quota1).toEqual({ op: "screenedIn" });
    });

    test("should filter by quota with screened out status", () => {
      const selectedFilter: SelectedFilterValue = {
        responseStatus: "all",
        filter: [
          {
            elementType: { type: "Quotas", label: "Quota 1", id: "quota1" },
            filterType: { filterComboBoxValue: "Screened out (overquota)" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.quotas?.quota1).toEqual({ op: "screenedOut" });
    });

    test("should filter by quota with not in quota status", () => {
      const selectedFilter: SelectedFilterValue = {
        responseStatus: "all",
        filter: [
          {
            elementType: { type: "Quotas", label: "Quota 1", id: "quota1" },
            filterType: { filterComboBoxValue: "Not in quota" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.quotas?.quota1).toEqual({ op: "screenedOutNotInQuota" });
    });

    test("should filter by multiple quotas with different statuses", () => {
      const selectedFilter: SelectedFilterValue = {
        responseStatus: "all",
        filter: [
          {
            elementType: { type: "Quotas", label: "Quota 1", id: "quota1" },
            filterType: { filterComboBoxValue: "Screened in" },
          },
          {
            elementType: { type: "Quotas", label: "Quota 2", id: "quota2" },
            filterType: { filterComboBoxValue: "Not in quota" },
          },
        ],
      } as any;

      const result = getFormattedFilters(survey, selectedFilter, {} as any);

      expect(result.quotas?.quota1).toEqual({ op: "screenedIn" });
      expect(result.quotas?.quota2).toEqual({ op: "screenedOutNotInQuota" });
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
