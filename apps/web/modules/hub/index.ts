export { getHubClient } from "./hub-client";
export {
  createFeedbackRecord,
  createFeedbackRecordsBatch,
  listFeedbackRecords,
  retrieveFeedbackRecord,
  updateFeedbackRecord,
  type HubFeedbackRecordResult,
  type ListFeedbackRecordsResult,
} from "./service";
export type {
  FeedbackRecordCreateParams,
  FeedbackRecordData,
  FeedbackRecordListParams,
  FeedbackRecordListResponse,
  FeedbackRecordUpdateParams,
} from "./types";
