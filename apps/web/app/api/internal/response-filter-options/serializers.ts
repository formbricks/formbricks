import type { TSurveyQuota } from "@formbricks/types/quota";
import type {
  TResponseHiddenFieldsFilter,
  TSurveyContactAttributes,
  TSurveyMetaFieldFilter,
} from "@formbricks/types/responses";
import type { TTag } from "@formbricks/types/tags";

/** A tag or quota the filter offers as a property: its id is what a rule names, its name what it shows. */
export type TResponseFilterOptionRef = { id: string; name: string };

/**
 * What the Responses / Summary filter offers beyond the survey itself: the workspace's tags, the survey's
 * quotas (when the organization has them), and the values its responses hold for contact attributes,
 * hidden fields, reserved fields and variables — exactly what the filter builds its properties from.
 */
export type TResponseFilterOptionsResource = {
  tags: TResponseFilterOptionRef[];
  attributes: TSurveyContactAttributes;
  hiddenFields: TResponseHiddenFieldsFilter;
  reservedValues: TSurveyMetaFieldFilter;
  variableValues: TSurveyMetaFieldFilter;
  quotas: TResponseFilterOptionRef[];
};

const toRef = ({ id, name }: { id: string; name: string }): TResponseFilterOptionRef => ({ id, name });

export const serializeResponseFilterOptions = ({
  tags,
  quotas,
  ...values
}: Omit<TResponseFilterOptionsResource, "tags" | "quotas"> & {
  tags: TTag[];
  quotas: TSurveyQuota[];
}): TResponseFilterOptionsResource => ({
  tags: tags.map(toRef),
  attributes: values.attributes,
  hiddenFields: values.hiddenFields,
  reservedValues: values.reservedValues,
  variableValues: values.variableValues,
  quotas: quotas.map(toRef),
});
