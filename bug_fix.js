import { t } from "@/lib/i18n"; // adjust import based on project

const conditionOptions: Record<string, string[]> = {
  openText: [t("filters.is")],
  multipleChoiceSingle: [t("filters.includesEither")],
  multipleChoiceMulti: [t("filters.includesAll"), t("filters.includesEither")],
  nps: [
    t("filters.isEqualTo"),
    t("filters.isLessThan"),
    t("filters.isMoreThan"),
    t("filters.submitted"),
    t("filters.skipped"),
    t("filters.includesEither"),
  ],
  rating: [
    t("filters.isEqualTo"),
    t("filters.isLessThan"),
    t("filters.isMoreThan"),
    t("filters.submitted"),
    t("filters.skipped"),
  ],
  cta: [t("filters.is")],
  tags: [t("filters.is")],
  languages: [t("filters.equals"), t("filters.notEquals")],
  pictureSelection: [t("filters.includesAll"), t("filters.includesEither")],
  userAttributes: [t("filters.equals"), t("filters.notEquals")],
  consent: [t("filters.is")],
  matrix: [""],
  address: [t("filters.is")],
  contactInfo: [t("filters.is")],
  ranking: [t("filters.is")],
};

const filterOptions: Record<string, string[]> = {
  openText: [t("filters.filledOut"), t("filters.skipped")],
  rating: ["1", "2", "3", "4", "5"],
  nps: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  cta: [t("filters.clicked"), t("filters.dismissed")],
  tags: [t("filters.applied"), t("filters.notApplied")],
  consent: [t("filters.accepted"), t("filters.dismissed")],
  address: [t("filters.filledOut"), t("filters.skipped")],
  contactInfo: [t("filters.filledOut"), t("filters.skipped")],
  ranking: [t("filters.filledOut"), t("filters.skipped")],
};

const META_OP_MAP = {
  [t("filters.equals")]: "equals",
  [t("filters.notEquals")]: "notEquals",
  [t("filters.contains")]: "contains",
  [t("filters.doesNotContain")]: "doesNotContain",
  [t("filters.startsWith")]: "startsWith",
  [t("filters.doesNotStartWith")]: "doesNotStartWith",
  [t("filters.endsWith")]: "endsWith",
  [t("filters.doesNotEndWith")]: "doesNotEndWith",
} as const;
