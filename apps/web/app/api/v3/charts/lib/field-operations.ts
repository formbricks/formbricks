import "server-only";
import { logger } from "@formbricks/logger";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import {
  refuseUnlessFeedbackDatasetAccess,
  requireDashboardsAccess,
} from "@/app/api/v3/lib/dashboards-access";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  problemBadGateway,
  problemUnauthorized,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { CubeQueryError, executeTenantScopedQuery } from "@/modules/ee/analysis/api/lib/cube-client";
import {
  ANSWER_OPERATORS,
  type TAnswerQuestion,
  formatAnswerValue,
} from "@/modules/ee/analysis/lib/answer-filter";
import { getDatasetChartFields } from "@/modules/ee/analysis/lib/dataset-chart-fields";
import { getDatasetTopics } from "@/modules/ee/analysis/lib/dataset-topics";
import {
  buildDimensionValueQuery,
  collectDimensionValues,
} from "@/modules/ee/analysis/lib/dimension-value-lookup";
import { isEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-data-fields";
import {
  CHART_DATE_PRESETS,
  type TChartField,
  TOPICS_UNAVAILABLE_REASONS,
  createChartFieldLookup,
  getChartFieldCatalog,
} from "@/modules/ee/analysis/lib/field-catalog";
import { isSubtopicDimensionId, isTopicDimensionId } from "@/modules/ee/analysis/lib/schema-definition";
import { applyChartQueryRateLimit, withChartQuerySlot } from "./data-operations";
import type { TV3ChartFieldCatalog } from "./resources";
import type { TV3ChartFieldValuesQuery } from "./schemas";

type TV3ReadContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

const serializeCatalog = (
  fields: readonly TChartField[],
  answerQuestions: readonly TAnswerQuestion[]
): TV3ChartFieldCatalog => ({
  fields: fields.map((field) => ({
    ...field,
    filterOperators: [...field.filterOperators],
    granularities: [...field.granularities],
  })),
  datePresets: [...CHART_DATE_PRESETS],
  // The questions an answer rule may name, so an API or MCP caller can write one as the builder does (C14).
  answerQuestions: answerQuestions.map(({ id, label, kind, options }) => ({
    id,
    label,
    kind,
    operators: [...ANSWER_OPERATORS[kind]],
    options: options.map((option) => ({ value: formatAnswerValue(id, option.value), label: option.label })),
  })),
});

/**
 * `GET /api/v3/charts/fields` → 200 `{ data: { fields, datePresets } }`.
 *
 * Answered per dataset: the caller has to be able to read the dataset it is about to write a query for,
 * and each dataset adds its embedded-data keys as `FeedbackRecords.ed_*` fields, labelled by the key
 * (ENG-6893), the questions an answer rule may name (`answerQuestions`, C14), and, when it has an active
 * taxonomy the organization may read, the topic fields (ENG-6989). Returns a `Response` and never throws — the MCP server calls it directly, with no wrapper.
 */
export async function getV3ChartFieldCatalog({
  workspaceId,
  datasetId,
  authentication,
  requestId,
  instance,
}: TV3ReadContext & { workspaceId: string; datasetId: string }): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId, datasetId });

  try {
    const access = await requireDashboardsAccess(authentication, workspaceId, "read", requestId, instance);
    if (access instanceof Response) return access;

    const refused = await refuseUnlessFeedbackDatasetAccess(
      authentication,
      access,
      datasetId,
      "read",
      requestId,
      instance
    );
    if (refused) return refused;

    const actor = getV3AuthorizationActor(authentication);
    if (!actor) return problemUnauthorized(requestId, "Not authenticated", instance);

    const dataset = await getDatasetChartFields(
      { datasetId, workspaceId: access.workspaceId, organizationId: access.organizationId, actor },
      { withAnswerQuestions: true, withTopics: true }
    );
    return successResponse(serializeCatalog(getChartFieldCatalog(dataset), dataset.answerQuestions ?? []), {
      requestId,
    });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "charts.fields" });
  }
}

/**
 * Most distinct values a lookup returns. A pick-list, not an export: a field with more values is
 * narrowed server-side with `search`.
 */
export const FIELD_VALUE_LOOKUP_LIMIT = 100;

/**
 * A topic field's values (ENG-6989): the dataset's current topic labels, from its active taxonomy rather
 * than from the records, so every label a filter may use is offered, one with no record yet included.
 * `search` matches anywhere in a label, case aside, as the Cube lookup's `contains` does.
 */
const listTopicFieldValues = async ({
  field,
  query,
  organizationId,
  requestId,
  instance,
}: {
  field: string;
  query: TV3ChartFieldValuesQuery;
  organizationId: string;
  requestId: string;
  instance: string;
}): Promise<Response> => {
  const topics = await getDatasetTopics({ datasetId: query.datasetId, organizationId });
  if (topics.status === "unavailable") {
    return problemBadGateway(requestId, "The topics could not be loaded. Try again shortly.", instance);
  }
  if (topics.status !== "active") {
    return problemUnprocessableContent(requestId, "This dataset has no topics to look up", {
      instance,
      invalid_params: [
        { name: "field", reason: TOPICS_UNAVAILABLE_REASONS[topics.status], code: "invalid_reference" },
      ],
    });
  }
  const labels = isSubtopicDimensionId(field) ? topics.labels.subtopics : topics.labels.topics;
  const search = query.search?.toLocaleLowerCase();
  const matching = search ? labels.filter((label) => label.toLocaleLowerCase().includes(search)) : labels;
  return successResponse(
    matching.slice(0, FIELD_VALUE_LOOKUP_LIMIT).map((value) => ({ value })),
    { requestId }
  );
};

/**
 * `GET /api/v3/charts/fields/{field}/values` → 200 `{ data: [{ value, fieldType? }] }`.
 *
 * The stored values of a low-cardinality dimension, so a filter can use a value that really occurs —
 * an exact `equals` match then cannot miss on casing or spacing. Only catalog fields marked
 * `valueLookup` qualify: free-text dimensions are not a pick-list. Needs read access to the Feedback
 * Dataset, and spends from the chart-query budget, since it runs a query.
 */
export async function listV3ChartFieldValues({
  field,
  query,
  authentication,
  requestId,
  instance,
}: TV3ReadContext & { field: string; query: TV3ChartFieldValuesQuery }): Promise<Response> {
  const context = { authentication, requestId, instance };
  const log = logger.withContext({ requestId, workspaceId: query.workspaceId, datasetId: query.datasetId });

  try {
    const limited = await applyChartQueryRateLimit(context);
    if (limited) return limited;

    const access = await requireDashboardsAccess(
      authentication,
      query.workspaceId,
      "read",
      requestId,
      instance
    );
    if (access instanceof Response) return access;

    const refused = await refuseUnlessFeedbackDatasetAccess(
      authentication,
      access,
      query.datasetId,
      "read",
      requestId,
      instance
    );
    if (refused) return refused;

    const actor = getV3AuthorizationActor(authentication);
    if (!actor) return problemUnauthorized(requestId, "Not authenticated", instance);

    if (isTopicDimensionId(field)) {
      return await listTopicFieldValues({
        field,
        query,
        organizationId: access.organizationId,
        requestId,
        instance,
      });
    }

    // A dataset's embedded-data fields are looked up like any low-cardinality dimension.
    const lookupField = isEmbeddedMemberName(field)
      ? createChartFieldLookup(
          await getDatasetChartFields({
            datasetId: query.datasetId,
            workspaceId: access.workspaceId,
            organizationId: access.organizationId,
            actor,
          })
        )
      : createChartFieldLookup();
    if (!lookupField(field)?.valueLookup) {
      return problemUnprocessableContent(requestId, "This field's values cannot be looked up", {
        instance,
        invalid_params: [
          {
            name: "field",
            reason:
              "Must be a field from the field catalog with valueLookup: true. Free-text fields are filtered with 'contains' instead.",
            code: "invalid_reference",
          },
        ],
      });
    }

    return await withChartQuerySlot(context, async () => {
      const rows = await executeTenantScopedQuery({
        query: buildDimensionValueQuery({
          dimension: field,
          limit: FIELD_VALUE_LOOKUP_LIMIT,
          search: query.search,
        }),
        feedbackDirectoryId: query.datasetId,
        workspaceId: access.workspaceId,
        organizationId: access.organizationId,
        actor,
        source: "v3.charts.fieldValues",
      });
      return successResponse(collectDimensionValues(rows, field, FIELD_VALUE_LOOKUP_LIMIT), { requestId });
    });
  } catch (error) {
    if (error instanceof CubeQueryError) {
      return problemBadGateway(
        requestId,
        error.timedOut
          ? "The value lookup took too long and was stopped."
          : "The values could not be looked up. Try again shortly.",
        instance
      );
    }
    return mapV3ThrownError(error, { log, requestId, instance, operation: "charts.fieldValues" });
  }
}
