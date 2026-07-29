export { getHubClient } from "./hub-client";
export {
  createFeedbackRecord,
  createFeedbackRecordsBatch,
  listFeedbackRecords,
  retrieveFeedbackRecord,
  type HubFeedbackRecordResult,
  type ListFeedbackRecordsResult,
} from "./service";
export type {
  FeedbackRecordCreateParams,
  FeedbackRecordData,
  FeedbackRecordListParams,
  FeedbackRecordListResponse,
} from "./types";
