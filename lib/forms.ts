import useSWR from "swr";
import { fetcher } from "./utils";

export const useForms = () => {
  const { data, error, mutate } = useSWR(`/api/forms/`, fetcher);

  return {
    forms: data,
    isLoadingForms: !error && !data,
    isErrorForms: error,
    mutateForms: mutate,
  };
};

export const useForm = (id: string) => {
  const { data, error, mutate } = useSWR(`/api/forms/${id}/`, fetcher);

  return {
    form: data,
    isLoadingForm: !error && !data,
    isErrorForm: error,
    mutateForm: mutate,
  };
};

export const persistForm = async (form) => {
  try {
    await fetch(`/api/forms/${form.id}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
  } catch (error) {
    console.error(error);
  }
};

export const createForm = async (form = {}) => {
  try {
    console.log("form", form);
    const res = await fetch(`/api/forms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    return await res.json();
  } catch (error) {
    console.error(error);
    throw Error(`createForm: unable to create form: ${error.message}`);
  }
};

export const getFormElementFieldSetter = (
  form: any,
  mutateForm: (any, boolean?) => void,
  pageId: string,
  elementId: string
) => {
  return (input, field, parentField = "") =>
    setFormElementField(
      form,
      mutateForm,
      pageId,
      elementId,
      input,
      field,
      parentField
    );
};

export const setFormElementField = (
  form: any,
  mutateForm: (any, boolean?) => void,
  pageId: string,
  elementId: string,
  input: string | number,
  field: string,
  parentField: string = ""
) => {
  const updatedForm = JSON.parse(JSON.stringify(form));
  const elementIdx = getFormPage(updatedForm, pageId).elements.findIndex(
    (e) => e.id === elementId
  );
  if (typeof elementIdx === "undefined") {
    throw Error(
      `setFormElementField: unable to find element with id ${elementId}`
    );
  }
  if (parentField !== "") {
    getFormPage(updatedForm, pageId).elements[elementIdx][parentField][field] =
      input;
  } else {
    getFormPage(updatedForm, pageId).elements[elementIdx][field] = input;
  }
  mutateForm(updatedForm, false);
  return updatedForm;
};

export const getFormPage = (form, pageId) => {
  const page = form.pages.find((p) => p.id === pageId);
  if (typeof page === "undefined") {
    throw Error(`getFormPage: unable to find page with id ${pageId}`);
  }
  return page;
};

export const getFormPages = async (formId) => {
  try {
    const res = await fetch(`/api/forms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formId),
    });
    return await res.json();
  } catch (error) {
    console.error(error);
    throw Error(`createForm: unable to create form: ${error.message}`);
  }
};
