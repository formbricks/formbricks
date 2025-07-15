import { TPlainFieldType } from "@formbricks/types/integration/plain";

export const PLAIN_FIELD_TYPES: {
  id: string;
  name: string;
  type: TPlainFieldType;
}[] = [
  { id: "threadTitle", name: "Thread Title", type: "threadField" as TPlainFieldType },
  { id: "componentText", name: "Component Text", type: "componentText" as TPlainFieldType },
  { id: "labelTypeId", name: "Label ID", type: "labelTypeId" as TPlainFieldType },
];

export const INITIAL_MAPPING = [
  {
    plainField: { id: "threadTitle", name: "Thread Title", type: "title" as TPlainFieldType },
    question: { id: "", name: "", type: "" },
    isMandatory: true,
  },
  {
    plainField: { id: "componentText", name: "Component Text", type: "componentText" as TPlainFieldType },
    question: { id: "", name: "", type: "" },
    isMandatory: true,
  },
] as const;
