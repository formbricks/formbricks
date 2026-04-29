import type FormbricksHub from "@formbricks/hub";

export type FeedbackRecordCreateParams = FormbricksHub.FeedbackRecordCreateParams;
export type FeedbackRecordData = FormbricksHub.FeedbackRecordData;
export type FeedbackRecordListParams = FormbricksHub.FeedbackRecordListParams;
export type FeedbackRecordListResponse = FormbricksHub.FeedbackRecordListResponse;
export type FeedbackRecordUpdateParams = FormbricksHub.FeedbackRecordUpdateParams;

export type SemanticSearchInput = {
  query: string;
  tenant_id: string;
  limit?: number;
  cursor?: string;
  min_score?: number;
};

export type SemanticSearchResultItem = {
  feedback_record_id: string;
  score: number;
  field_label: string;
  value_text: string;
};

export type SemanticSearchResponse = {
  data: SemanticSearchResultItem[];
  limit: number;
  next_cursor?: string;
};
