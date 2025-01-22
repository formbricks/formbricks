import { type NetworkError, type Result, okVoid } from "../types/errors";
import { UpdateQueue } from "./update-queue";

const updateQueue = UpdateQueue.getInstance();

export const setAttributesInApp = async (
  attributes: Record<string, string>
  // eslint-disable-next-line @typescript-eslint/require-await -- we want to use promises here
): Promise<Result<void, NetworkError>> => {
  updateQueue.updateAttributes(attributes);
  void updateQueue.processUpdates();
  return okVoid();
};

// export const setAttributesInApp = async (attributes: Record<string, string>): Promise<void> => {
//   updateQueue.updateAttributes(attributes);
//   void updateQueue.processUpdates();

// const { apiHost, environmentId } = appConfig.get();
// const userId = appConfig.get().personState.data.userId;

// // Don't proceed if userId is not set
// if (!userId) {
//   logger.error(
//     "UserId not provided, please provide a userId through the setUserId method before setting attributes."
//   );
//   return okVoid();
// }

// // can't pass "{}" as attributes
// if (Object.keys(attributes).length === 0) {
//   logger.debug("No attributes to update. Skipping update.");
//   return okVoid();
// }

// // can't pass "userId" as a key
// if (attributes.userId) {
//   logger.debug(
//     "Setting userId is no longer supported. Please set the userId through the setUserId method instead. Skipping userId."
//   );
// }

// const { userId: _, ...rest } = attributes;

// const result = await updateAttributes(apiHost, environmentId, userId, rest);

// if (result.ok) {
//   if (result.data.changed) {
//     const personState = await fetchPersonState(
//       {
//         apiHost: appConfig.get().apiHost,
//         environmentId: appConfig.get().environmentId,
//         userId,
//       },
//       true
//     );

//     const filteredSurveys = filterSurveys(appConfig.get().environmentState, personState);

//     appConfig.update({
//       ...appConfig.get(),
//       personState,
//       filteredSurveys,
//       attributes: {
//         ...appConfig.get().attributes,
//         ...rest,
//       },
//     });
//   }

//   return okVoid();
// }
// const error = result.error;
// if (error.code === "forbidden") {
//   logger.error(`Authorization error: ${error.responseMessage ?? ""}`);
// }

// return err(result.error);
// const { apiHost, environmentId } = appConfig.get();
// const userId = appConfig.get().personState.data.userId;

// // Don't proceed if userId is not set
// if (!userId) {
//   logger.error(
//     "UserId not provided, please provide a userId through the setUserId method before setting attributes."
//   );
//   return okVoid();
// }

// // can't pass "{}" as attributes
// if (Object.keys(attributes).length === 0) {
//   logger.debug("No attributes to update. Skipping update.");
//   return okVoid();
// }

// // can't pass "userId" as a key
// if (attributes.userId) {
//   logger.debug(
//     "Setting userId is no longer supported. Please set the userId through the setUserId method instead. Skipping userId."
//   );
// }

// const { userId: _, ...rest } = attributes;

// const result = await updateAttributes(apiHost, environmentId, userId, rest);

// if (result.ok) {
//   if (result.data.changed) {
//     const personState = await fetchPersonState(
//       {
//         apiHost: appConfig.get().apiHost,
//         environmentId: appConfig.get().environmentId,
//         userId,
//       },
//       true
//     );

//     const filteredSurveys = filterSurveys(appConfig.get().environmentState, personState);

//     appConfig.update({
//       ...appConfig.get(),
//       personState,
//       filteredSurveys,
//       attributes: {
//         ...appConfig.get().attributes,
//         ...rest,
//       },
//     });
//   }

//   return okVoid();
// }
// const error = result.error;
// if (error.code === "forbidden") {
//   logger.error(`Authorization error: ${error.responseMessage ?? ""}`);
// }

// return err(result.error);
// };
