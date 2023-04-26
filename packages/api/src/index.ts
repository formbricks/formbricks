import { FormbricksAPI } from "./lib";

export const run = async () => {
  const api = new FormbricksAPI(
    "http://localhost:3000", // apiHost
    "clgwh8maj0005n2f66pwzev3r" // environmentId
  );

  const response = await api.startResponse(
    "clgwhyyqn006mn20k4ebesmoo", // surveyId
    "clgwjcoex000mn2edfmxr6w8p", // personId
    {
      qduxwjp8ypimqgf81k2uxep2: "Not at all disappointed", // data
    }
  );

  if (response.ok === false) {
    console.log("create error", response.error);
    return;
  }

  console.log("created response", response.value);

  const updateResponse = await api.updateResponse(
    response.value.id, // responseId
    {
      j3ikcsky3bb5c15t762zs86j: "Product Owner", // data
    }
  );

  if (updateResponse.ok === false) {
    console.log("update error", updateResponse.error);
    return;
  }

  console.log("updated response", updateResponse.value);
};
