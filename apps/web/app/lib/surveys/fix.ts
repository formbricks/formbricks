export const conditionOptions: Record<string, string[]> = {
  openText: ["is"],
  multipleChoiceSingle: ["includesEither"],
  multipleChoiceMulti: ["includesAll", "includesEither"],
  nps: [
    "isEqualTo",
    "isLessThan",
    "isMoreThan",
    "submitted",
    "skipped",
    "includesEither",
  ],
  rating: [
    "isEqualTo",
    "isLessThan",
    "isMoreThan",
    "submitted",
    "skipped",
  ],
  cta: ["is"],
  tags: ["is"],
  languages: ["equals", "notEquals"],
  pictureSelection: ["includesAll", "includesEither"],
  userAttributes: ["equals", "notEquals"],
  consent: ["is"],
  matrix: [""],
  address: ["is"],
  contactInfo: ["is"],
  ranking: ["is"],
};

export const filterOptions: Record<string, string[]> = {
  openText: ["filledOut", "skipped"],
  rating: ["1", "2", "3", "4", "5"],
  nps: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  cta: ["clicked", "dismissed"],
  tags: ["applied", "notApplied"],
  consent: ["accepted", "dismissed"],
  address: ["filledOut", "skipped"],
  contactInfo: ["filledOut", "skipped"],
  ranking: ["filledOut", "skipped"],
};

export const META_OP_MAP = {
  equals: "equals",
  notEquals: "notEquals",
  contains: "contains",
  doesNotContain: "doesNotContain",
  startsWith: "startsWith",
  doesNotStartWith: "doesNotStartWith",
  endsWith: "endsWith",
  doesNotEndWith: "doesNotEndWith",
} as const;
