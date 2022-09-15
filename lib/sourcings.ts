import useSWR from "swr";
import { fetcher } from "./utils";

export const useSourcings = () => {
  const { data, error, mutate } = useSWR(`/api/sourcing/`, fetcher);

  return {
    sourcing: data,
    isLoadingSourcings: !error && !data,
    isErrorSourcing: error,
    mutateSourcing: mutate,
  };
};

export const useSourcing = (id: string) => {
  const { data, error, mutate } = useSWR(`/api/sourcing/${id}/`, fetcher);

  return {
    sourcing: data,
    isLoadingSourcing: !error && !data,
    isErrorSourcing: error,
    mutateSourcing: mutate,
  };
};

export const persistSourcing = async (sourcing) => {
  try {
    await fetch(`/api/forms/${sourcing.id}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sourcing),
    });
  } catch (error) {
    console.error(error);
  }
};

export const createSourcing = async (sourcing = {}) => {
  try {
    const res = await fetch(`/api/forms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sourcing),
    });
    return await res.json();
  } catch (error) {
    console.error(error);
    throw Error(`createSourcing: unable to create sourcing: ${error.message}`);
  }
};

// export const getFormElementFieldSetter = (
//   form: any,
//   mutateForm: (any, boolean?) => void,
//   pageId: string,
//   elementId: string
// ) => {
//   return (input, field, parentField = "") =>
//     setFormElementField(
//       form,
//       mutateForm,
//       pageId,
//       elementId,
//       input,
//       field,
//       parentField
//     );
// };

// export const setFormElementField = (
//   form: any,
//   mutateForm: (any, boolean?) => void,
//   pageId: string,
//   elementId: string,
//   input: string | number,
//   field: string,
//   parentField: string = ""
// ) => {
//   const updatedForm = JSON.parse(JSON.stringify(form));
//   const elementIdx = getFormPage(updatedForm, pageId).elements.findIndex(
//     (e) => e.id === elementId
//   );
//   if (typeof elementIdx === "undefined") {
//     throw Error(
//       `setFormElementField: unable to find element with id ${elementId}`
//     );
//   }
//   if (parentField !== "") {
//     getFormPage(updatedForm, pageId).elements[elementIdx][parentField][field] =
//       input;
//   } else {
//     getFormPage(updatedForm, pageId).elements[elementIdx][field] = input;
//   }
//   mutateForm(updatedForm, false);
//   return updatedForm;
// };

// export const getFormPage = (form, pageId) => {
//   const page = form.pages.find((p) => p.id === pageId);
//   if (typeof page === "undefined") {
//     throw Error(`getFormPage: unable to find page with id ${pageId}`);
//   }
//   return page;
// };
