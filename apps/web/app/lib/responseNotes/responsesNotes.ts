export const addResponseNote = async (
  environmentId: string,
  surveyId: string,
  responseId: string,
  text: string
) => {
  try {
    const res = await fetch(
      `/api/v1/environments/${environmentId}/surveys/${surveyId}/responses/${responseId}/responsesNotes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(text),
      }
    );
    return await res.json();
  } catch (error) {
    console.error(error);
    throw Error(`createResponseNote: unable to create responseNote: ${error.message}`);
  }
};
