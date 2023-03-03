import useSWR from "swr";
import { fetcher } from "@/lib/utils";

export const useSubmissions = (organisationId: string, formId: string) => {
  const { data, error, mutate } = useSWR(
    `/api/organisations/${organisationId}/forms/${formId}/submissions`,
    fetcher
  );

  return {
    submissions: data,
    isLoadingSubmissions: !error && !data,
    isErrorSubmissions: error,
    mutateSubmissions: mutate,
  };
};

export const deleteSubmission = async (organisationId: string, formId: string, submissionId: string) => {
  try {
    await fetch(`/api/organisations/${organisationId}/forms/${formId}/submissions/${submissionId}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error(error);
    throw Error(`deleteSubmission: unable to delete submission: ${error.message}`);
  }
};

export const persistSubmission = async (submission, organisationId) => {
  try {
    await fetch(
      `/api/organisations/${organisationId}/forms/${submission.formId}/submissions/${submission.id}/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      }
    );
  } catch (error) {
    console.error(error);
  }
};

export const MergeWithSchema = (submissionData, schema) => {
  if (Object.keys(schema).length === 0) {
    // no schema provided
    return submissionData;
  }
  const mergedData = {};
  if (!submissionData) {
    return mergedData;
  }
  const optionLabelMap = getOptionLabelMap(schema);
  for (const page of schema.pages) {
    for (const elem of page.elements) {
      if (
        ![
          "checkbox",
          "email",
          "number",
          "nps",
          "phone",
          "radio",
          "search",
          "text",
          "textarea",
          "url",
          "scale",
        ].includes(elem.type)
      ) {
        continue;
      }
      if (elem.name in submissionData) {
        if (["checkbox", "radio"].includes(elem.type)) {
          if (Array.isArray(submissionData[elem.name])) {
            mergedData[elem.label] = submissionData[elem.name]
              .map((value) => optionLabelMap[value] || value)
              .join(", ");
          } else {
            mergedData[elem.label] = optionLabelMap[submissionData[elem.name]] || submissionData[elem.name];
          }
        } else {
          mergedData[elem.label] = submissionData[elem.name];
        }
      } else {
        // mergedData[elem.label] = "not provided";
      }
    }
  }
  return mergedData;
};

export const getOptionLabelMap = (schema) => {
  if (!schema || !schema.pages) {
    return {};
  }
  const optionLabelMap = {};
  for (const page of schema.pages) {
    for (const elem of page.elements) {
      if (elem.options && elem.options.length > 0) {
        for (const option of elem.options) {
          optionLabelMap[option.value] = option.label;
        }
      }
    }
  }
  return optionLabelMap;
};
