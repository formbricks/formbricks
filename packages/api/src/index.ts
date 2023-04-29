export * from "./dtos/";
export * from "./errors";
export * from "./lib";
export { FormbricksAPI as default } from "./lib";
// do not export RequestFn or Brand or IEnvironmentId, they are internal
export type { EnvironmentId, IEnvironmentId, KeyValueData, PersonId, ResponseId, SurveyId } from "./types";

// export const run = async () => {
//   const api = new FormbricksAPI({
//     apiHost: "http://localhost:3000",
//     environmentId: "clgwh8maj0005n2f66pwzev3r" as EnvironmentId,
//   });

//   const response = await api.createResponse({
//     surveyId: "clgwhyyqn006mn20k4ebesmoo" as SurveyId, // 'as' will not be needed when passing a value from a function returning it
//     personId: "clgwjcoex000mn2edfmxr6w8p" as PersonId,
//     data: {
//       qduxwjp8ypimqgf81k2uxep2: "Not at all disappointed", // data
//     },
//   });

//   if (response.ok === false) {
//     console.log("create error", response.error);
//     return;
//   }

//   console.log("created response", response.data);

//   const updateResponse = await api.updateResponse({
//     responseId: response.data.id, // if it's for example a PersonId, it will throw an type error
//     data: {
//       j3ikcsky3bb5c15t762zs86j: "Product Owner", // data
//     },
//   });

//   if (updateResponse.ok === false) {
//     console.log("update error", updateResponse.error);
//     return;
//   }

//   console.log("updated response", updateResponse.data);
// };
