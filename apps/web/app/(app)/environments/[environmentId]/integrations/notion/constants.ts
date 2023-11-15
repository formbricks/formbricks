export const TYPE_MAPPING = {
  cta: ["checkbox"],
  multipleChoiceMulti: ["multi_select"],
  multipleChoiceSingle: ["select", "status"],
  openText: [
    "created_by",
    "created_time",
    "date",
    "email",
    "last_edited_by",
    "last_edited_time",
    "number",
    "phone_number",
    "rich_text",
    "title",
    "url",
  ],
  nps: ["number"],
  consent: ["checkbox"],
  rating: ["number"],
};

export const UNSUPPORTED_TYPES_BY_NOTION = [
  "rollup",
  "created_by",
  "created_time",
  "last_edited_by",
  "last_edited_time",
];

export const ERRORS = {
  MAPPING: "Mapping Error",
  UNSUPPORTED_TYPE: "Unsupported type by Notion",
};
